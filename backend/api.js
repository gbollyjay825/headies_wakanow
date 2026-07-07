const repository = require('./repository');
const { parsePassport } = require('./passport-parser');
const {
  calculateVisaAmountKobo,
  cleanCallbackUrl,
  initializePaystackTransaction,
  makePaymentReference,
  parseApplicants,
  verifyPaystackTransaction
} = require('./paystack');

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'HEADIES2026';
const SUPER_ADMIN_PASSCODE = process.env.SUPER_ADMIN_PASSCODE || 'HEADIES2027';

function response(status, data) {
  return { status, data };
}

function now() {
  return new Date().toISOString();
}

function safePaymentFields(application) {
  return {
    paymentStatus: application.paymentStatus,
    paymentReference: application.paymentReference,
    paymentAmount: application.paymentAmount,
    paymentCurrency: application.paymentCurrency,
    paymentPaidAt: application.paymentPaidAt,
    userType: application.userType
  };
}

function normalizeUserType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ['basic', 'premium', 'staff'].includes(type) ? type : 'basic';
}

function requestSuperCode(body, req) {
  return String(
    (req && req.headers && (req.headers['x-super-admin-code'] || req.headers['X-Super-Admin-Code'])) ||
    body.superAdminCode ||
    ''
  ).trim();
}

function adminRoleForCode(code) {
  if (String(code || '').trim() === SUPER_ADMIN_PASSCODE) return 'super';
  if (String(code || '').trim() === ADMIN_PASSCODE) return 'admin';
  return '';
}

function isSuperAdminRequest(body, req) {
  return adminRoleForCode(requestSuperCode(body, req)) === 'super';
}

function requireSuperAdmin(body, req) {
  if (isSuperAdminRequest(body, req)) return null;
  return response(403, { error: 'Super admin access is required for this action.' });
}

function userTypeLabel(userType) {
  if (userType === 'premium') return 'Premium';
  if (userType === 'staff') return 'Staff';
  return 'Basic';
}

function feeLabelFor(userType) {
  if (userType === 'staff') return 'Staff visa package: no payment required';
  return `${userTypeLabel(userType)} visa package: visa fee included, admin processing fee included, Headies ticket fee included`;
}

function makeStaffReference(applicationId) {
  const safeId = String(applicationId || 'visa').replace(/[^a-zA-Z0-9.-=]/g, '').slice(0, 24) || 'visa';
  return `staff-${safeId}-${Date.now().toString(36)}`;
}

function priceForUserType(pricing, userType) {
  if (userType === 'premium') return Number(pricing.premium || 0);
  if (userType === 'staff') return 0;
  return Number(pricing.basic || 0);
}

const DOC_FIELD_LABELS = {
  applicationForm: 'Completed Canada visa application form',
  resume: 'Updated CV / resume',
  passport: 'Valid passport',
  previousVisas: 'Previous and current visas',
  bankStatements: 'Bank statements',
  taxClearance: 'Personal tax clearance certificate',
  employmentLetter: 'Employment letter',
  paySlips: '6 months pay slips',
  staffId: 'Staff ID card',
  introductionLetter: 'Introduction letter from employer',
  cac: 'CAC registration documents',
  companyIntro: 'Company introduction letter',
  companyTax: 'Company tax clearance certificate',
  businessBank: 'Business and personal bank statements'
};

function requiredDocFieldsFor(category) {
  const value = String(category || '').trim();
  const fields = ['applicationForm', 'resume', 'passport', 'previousVisas', 'bankStatements', 'taxClearance'];
  if (value === 'employed' || value === 'employed-business-owner') {
    fields.push('employmentLetter', 'paySlips', 'staffId', 'introductionLetter');
  }
  if (value === 'business-owner' || value === 'employed-business-owner') {
    fields.push('cac', 'companyIntro', 'companyTax', 'businessBank');
  }
  return fields;
}

/**
 * Fields that will have at least one document AFTER persistence runs.
 * Mirrors the upsert contract exactly: when the body omits `uploads`, stored
 * documents are preserved as-is; when it provides them, stored documents are
 * replaced by files carrying a dataUrl plus metadata echoes whose id matches a
 * currently stored document (stale/fabricated ids do not survive).
 */
function uploadedFieldSet(existing, bodyUploads) {
  const fields = new Set();
  const storedIds = new Set();
  ((existing && existing.uploads) || []).forEach((upload) => {
    (Array.isArray(upload.files) ? upload.files : []).forEach((file) => {
      if (file && file.id) storedIds.add(String(file.id));
    });
  });
  if (!Array.isArray(bodyUploads)) {
    ((existing && existing.uploads) || []).forEach((upload) => {
      if (Array.isArray(upload.files) && upload.files.length) fields.add(String(upload.field || ''));
    });
    return fields;
  }
  bodyUploads.forEach((upload) => {
    const surviving = (Array.isArray(upload && upload.files) ? upload.files : []).filter((file) => (
      file && (file.dataUrl || (file.id && storedIds.has(String(file.id))))
    ));
    if (surviving.length) fields.add(String(upload.field || ''));
  });
  return fields;
}

async function handleApi(method, pathname, body = {}, req = null) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api') return null;

  if (method === 'GET' && parts[1] === 'health') {
    return response(200, {
      ok: true,
      service: 'headies-wakanow-api',
      storage: repository.mode
    });
  }

  if (parts[1] === 'admin' && method === 'POST' && parts[2] === 'authorize') {
    const role = adminRoleForCode(body.passcode);
    if (!role) return response(401, { error: 'Invalid admin passcode.' });
    return response(200, { role, superAdmin: role === 'super' });
  }

  if (parts[1] === 'requests') {
    if (method === 'GET' && parts.length === 2) {
      return response(200, { requests: await repository.listRequests() });
    }
    if (method === 'POST' && parts.length === 2) {
      return response(201, { request: await repository.createRequest(body) });
    }
    if (method === 'PATCH' && parts.length === 3) {
      const updated = await repository.updateRequest(parts[2], body);
      if (!updated) return response(404, { error: 'Request not found' });
      return response(200, { request: updated });
    }
  }

  if (parts[1] === 'eligible') {
    if (method === 'GET' && parts.length === 2) {
      return response(200, { applicants: await repository.listEligible() });
    }
    if (method === 'POST' && parts[2] === 'signup') {
      let applicant;
      try {
        applicant = await repository.signupApplicant(body);
      } catch (error) {
        return response(error.status || 400, { error: error.message || 'Could not complete applicant signup.' });
      }
      return response(201, {
        applicant: {
          id: applicant.id,
          name: applicant.name,
          email: applicant.email,
          phone: applicant.phone,
          category: applicant.category,
          userType: applicant.userType,
          status: applicant.status,
          source: applicant.source,
          notes: applicant.notes,
          signupCompletedAt: applicant.signupCompletedAt,
          createdAt: applicant.createdAt,
          updatedAt: applicant.updatedAt
        }
      });
    }
    if (method === 'POST' && parts[2] === 'login') {
      const applicant = await repository.findEligibleLogin(body.email, body.accessCode);
      if (!applicant) return response(401, { error: 'Applicant is not eligible or the code is incorrect.' });
      return response(200, { applicant });
    }
    if (method === 'POST' && parts[2] === 'import') {
      const records = Array.isArray(body.records) ? body.records : [];
      try {
        const applicants = await repository.upsertEligibleRecords(records, {
          allowExistingUpdates: isSuperAdminRequest(body, req),
          allowPrivilegedUserTypes: isSuperAdminRequest(body, req)
        });
        return response(200, { count: records.length, applicants });
      } catch (error) {
        return response(error.status || 400, { error: error.message || 'Could not import approved applicants.' });
      }
    }
    if (method === 'POST' && parts.length === 2) {
      try {
        const applicants = await repository.upsertEligibleRecords([body], {
          allowExistingUpdates: isSuperAdminRequest(body, req),
          allowPrivilegedUserTypes: isSuperAdminRequest(body, req)
        });
        return response(201, { count: 1, applicants });
      } catch (error) {
        return response(error.status || 400, { error: error.message || 'Could not preload applicant.' });
      }
    }
    if (method === 'PATCH' && parts.length === 3) {
      const denied = requireSuperAdmin(body, req);
      if (denied) return denied;
      const updated = await repository.updateEligible(parts[2], body);
      if (!updated) return response(404, { error: 'Eligible applicant not found' });
      return response(200, { applicant: updated });
    }
    if (method === 'DELETE' && parts.length === 3) {
      const denied = requireSuperAdmin(body, req);
      if (denied) return denied;
      const deleted = await repository.deleteEligible(parts[2]);
      if (!deleted) return response(404, { error: 'Eligible applicant not found' });
      return response(200, { ok: true });
    }
  }

  if (parts[1] === 'visa' && parts[2] === 'pricing') {
    if (method === 'GET' && parts.length === 3) {
      return response(200, { pricing: await repository.getVisaPricing() });
    }
    if (method === 'PATCH' && parts.length === 3) {
      const denied = requireSuperAdmin(body, req);
      if (denied) return denied;
      return response(200, { pricing: await repository.updateVisaPricing(body.pricing || body) });
    }
  }

  if (parts[1] === 'passport' && parts[2] === 'parse') {
    if (method === 'POST' && parts.length === 3) {
      try {
        return response(200, await parsePassport(body));
      } catch (error) {
        return response(502, { error: error.message || 'Could not parse passport image.' });
      }
    }
  }

  if (parts[1] === 'payments' && parts[2] === 'paystack') {
    if (method === 'POST' && parts[3] === 'initialize') {
      const applicationId = String(body.applicationId || body.applicantId || body.id || '').trim();
      if (!applicationId) return response(400, { error: 'Application id is required for payment.' });

      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return response(400, { error: 'Applicant email is required for payment.' });

      const eligible = await repository.getEligible(body.applicantId || applicationId);
      if (!eligible || eligible.status !== 'active') return response(403, { error: 'Applicant is not active on the visa allowlist.' });
      const userType = normalizeUserType(eligible.userType);
      const pricing = await repository.getVisaPricing();
      const applicants = parseApplicants(body.applicants);
      const amount = calculateVisaAmountKobo(applicants, priceForUserType(pricing, userType));
      const currency = 'NGN';
      const reference = userType === 'staff' ? makeStaffReference(applicationId) : makePaymentReference(applicationId);
      const callbackUrl = cleanCallbackUrl(body.callbackUrl);
      const existing = await repository.getApplication(applicationId);
      const baseApplication = {
        id: applicationId,
        applicantId: body.applicantId || applicationId,
        name: body.name || eligible.name || (existing && existing.name) || '',
        email,
        phone: body.phone || eligible.phone || (existing && existing.phone) || '',
        applicants: String(applicants),
        applicantCategory: body.applicantCategory || eligible.category || (existing && existing.applicantCategory) || '',
        userType,
        passportExpiry: body.passportExpiry || (existing && existing.passportExpiry) || '',
        travelDate: body.travelDate || (existing && existing.travelDate) || '',
        travelHistory: body.travelHistory || (existing && existing.travelHistory) || '',
        role: body.role || (existing && existing.role) || '',
        salary: body.salary || (existing && existing.salary) || '',
        employmentLength: body.employmentLength || (existing && existing.employmentLength) || '',
        notes: body.notes || (existing && existing.notes) || '',
        fee: feeLabelFor(userType),
        status: (existing && existing.status) || 'Draft',
        passportDetails: body.passportDetails || (existing && existing.passportDetails) || null,
        reviewedAt: (existing && existing.reviewedAt) || '',
        createdAt: (existing && existing.createdAt) || undefined
      };

      if (userType === 'staff') {
        const application = await repository.upsertApplication({
          ...baseApplication,
          paymentStatus: 'Paid',
          paymentReference: (existing && existing.paymentReference && existing.paymentReference.startsWith('staff-')) ? existing.paymentReference : reference,
          paymentAmount: 0,
          paymentCurrency: currency,
          paymentPaidAt: (existing && existing.paymentPaidAt) || now()
        });
        return response(200, {
          application,
          payment: {
            authorizationUrl: '',
            accessCode: '',
            reference: application.paymentReference,
            amount: 0,
            currency,
            userType,
            staff: true
          }
        });
      }

      try {
        const initialized = await initializePaystackTransaction({
          email,
          amount,
          currency,
          reference,
          callback_url: callbackUrl || undefined,
          metadata: {
            applicationId,
            applicantId: body.applicantId || applicationId,
            applicants,
            userType,
            product: 'Headies x Wakanow Canada Business Visa'
          }
        });

        const paymentFields = {
          paymentStatus: 'Pending',
          paymentReference: initialized.data.reference || reference,
          paymentAmount: amount,
          paymentCurrency: currency
        };
        const application = await repository.upsertApplication({
          ...baseApplication,
          paymentPaidAt: (existing && existing.paymentPaidAt) || '',
          ...paymentFields
        });

        return response(200, {
          application,
          payment: {
            authorizationUrl: initialized.data.authorization_url,
            accessCode: initialized.data.access_code,
            reference: initialized.data.reference || reference,
            amount,
            currency,
            userType,
            staff: false
          }
        });
      } catch (error) {
        return response(502, { error: error.message || 'Could not initialize Paystack payment.' });
      }
    }

    if (method === 'POST' && parts[3] === 'verify') {
      const reference = String(body.reference || '').trim();
      if (!reference) return response(400, { error: 'Payment reference is required.' });

      const existing = await repository.getApplicationByPaymentReference(reference);
      if (!existing) return response(404, { error: 'Payment reference was not found for this application.' });

      try {
        const verified = await verifyPaystackTransaction(reference);
        const data = verified.data || {};
        const amountMatches = Number(data.amount || 0) === Number(existing.paymentAmount || 0);
        const currencyMatches = String(data.currency || existing.paymentCurrency || 'NGN').toUpperCase() === String(existing.paymentCurrency || 'NGN').toUpperCase();
        const isPaid = data.status === 'success' && amountMatches && currencyMatches;
        const application = await repository.updateApplicationPayment(existing.id, {
          paymentStatus: isPaid ? 'Paid' : 'Failed',
          paymentReference: reference,
          paymentAmount: existing.paymentAmount,
          paymentCurrency: existing.paymentCurrency || 'NGN',
          paymentPaidAt: isPaid ? (data.paid_at || now()) : ''
        });

        return response(200, {
          application,
          payment: {
            reference,
            status: application.paymentStatus,
            verified: isPaid,
            amountMatches,
            currencyMatches
          }
        });
      } catch (error) {
        return response(502, { error: error.message || 'Could not verify Paystack payment.' });
      }
    }
  }

  if (parts[1] === 'visa' && parts[2] === 'applications') {
    if (method === 'GET' && parts.length === 3) {
      return response(200, { applications: await repository.listApplications() });
    }
    if (method === 'GET' && parts.length === 4) {
      const application = await repository.getApplication(parts[3]);
      if (!application) return response(404, { error: 'Application not found' });
      return response(200, { application });
    }
    if (method === 'POST' && parts.length === 5 && parts[4] === 'documents') {
      const file = body.file;
      const field = String(body.field || '').trim();
      if (!field) return response(400, { error: 'Document field is required.' });
      if (!file || typeof file !== 'object' || !file.dataUrl) {
        return response(400, { error: 'A file with its data is required.' });
      }
      try {
        const application = await repository.setApplicationDocument(parts[3], {
          field,
          document: String(body.document || ''),
          required: Boolean(body.required),
          replaceField: Boolean(body.replaceField),
          file
        });
        return response(200, { application });
      } catch (error) {
        return response(error.status || 400, { error: error.message || 'Could not save the document.' });
      }
    }
    if (method === 'GET' && parts.length === 6 && parts[4] === 'documents') {
      try {
        const document = await repository.getApplicationDocument(parts[3], parts[5]);
        if (!document) return response(404, { error: 'Document not found' });
        return response(200, { __binaryFile: document });
      } catch {
        return response(404, { error: 'Document data is missing. Ask the applicant to upload it again.' });
      }
    }
    if (method === 'POST' && parts.length === 3) {
      const nextBody = { ...body };
      if (nextBody.status === 'Submitted') {
        const applicationId = nextBody.id || nextBody.applicantId;
        const existing = applicationId ? await repository.getApplication(applicationId) : null;
        if (!existing || existing.paymentStatus !== 'Paid') {
          return response(402, { error: 'Verified payment is required before submission.' });
        }
        if (nextBody.reviewConfirmed !== true) {
          return response(400, { error: 'Review confirmation is required before submission.' });
        }
        const category = nextBody.applicantCategory || existing.applicantCategory;
        const uploaded = uploadedFieldSet(existing, nextBody.uploads);
        const missing = requiredDocFieldsFor(category).filter((field) => !uploaded.has(field));
        if (missing.length) {
          const labels = missing.map((field) => DOC_FIELD_LABELS[field] || field).join(', ');
          return response(400, { error: `Upload the required documents before submission: ${labels}.` });
        }
        Object.assign(nextBody, safePaymentFields(existing), { reviewedAt: now() });
      }
      const application = await repository.upsertApplication(nextBody);
      return response(201, { application });
    }
    if (method === 'PATCH' && parts.length === 4) {
      if (body.status === 'Submitted') {
        const existing = await repository.getApplication(parts[3]);
        if (!existing) return response(404, { error: 'Application not found' });
        if (existing.paymentStatus !== 'Paid') {
          return response(402, { error: 'Verified payment is required before submission.' });
        }
        const uploaded = uploadedFieldSet(existing, undefined);
        const missing = requiredDocFieldsFor(existing.applicantCategory).filter((field) => !uploaded.has(field));
        if (missing.length) {
          const labels = missing.map((field) => DOC_FIELD_LABELS[field] || field).join(', ');
          return response(400, { error: `Upload the required documents before submission: ${labels}.` });
        }
      }
      const application = await repository.updateApplication(parts[3], body);
      if (!application) return response(404, { error: 'Application not found' });
      return response(200, { application });
    }
  }

  return response(404, { error: 'API route not found' });
}

module.exports = {
  handleApi
};
