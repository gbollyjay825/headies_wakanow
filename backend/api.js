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
    paymentPaidAt: application.paymentPaidAt
  };
}

async function handleApi(method, pathname, body = {}) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api') return null;

  if (method === 'GET' && parts[1] === 'health') {
    return response(200, {
      ok: true,
      service: 'headies-wakanow-api',
      storage: repository.mode
    });
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
      const applicants = await repository.upsertEligibleRecords(records);
      return response(200, { count: records.length, applicants });
    }
    if (method === 'POST' && parts.length === 2) {
      const applicants = await repository.upsertEligibleRecords([body]);
      return response(201, { count: 1, applicants });
    }
    if (method === 'PATCH' && parts.length === 3) {
      const updated = await repository.updateEligible(parts[2], body);
      if (!updated) return response(404, { error: 'Eligible applicant not found' });
      return response(200, { applicant: updated });
    }
    if (method === 'DELETE' && parts.length === 3) {
      const deleted = await repository.deleteEligible(parts[2]);
      if (!deleted) return response(404, { error: 'Eligible applicant not found' });
      return response(200, { ok: true });
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

      const applicants = parseApplicants(body.applicants);
      const amount = calculateVisaAmountKobo(applicants);
      const currency = 'NGN';
      const reference = makePaymentReference(applicationId);
      const callbackUrl = cleanCallbackUrl(body.callbackUrl);

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
            product: 'Headies x Wakanow Canada Business Visa'
          }
        });

        const paymentFields = {
          paymentStatus: 'Pending',
          paymentReference: initialized.data.reference || reference,
          paymentAmount: amount,
          paymentCurrency: currency
        };
        const existing = await repository.getApplication(applicationId);
        const application = existing
          ? await repository.updateApplicationPayment(applicationId, paymentFields)
          : await repository.upsertApplication({
              id: applicationId,
              applicantId: body.applicantId || applicationId,
              name: body.name || '',
              email,
              phone: body.phone || '',
              applicants: String(applicants),
              applicantCategory: body.applicantCategory || '',
              passportExpiry: body.passportExpiry || '',
              travelDate: body.travelDate || '',
              travelHistory: body.travelHistory || '',
              role: body.role || '',
              salary: body.salary || '',
              employmentLength: body.employmentLength || '',
              notes: body.notes || '',
              fee: 'NGN745,000 per applicant',
              status: 'Draft',
              uploads: [],
              passportDetails: body.passportDetails || null,
              ...paymentFields
            });

        return response(200, {
          application,
          payment: {
            authorizationUrl: initialized.data.authorization_url,
            accessCode: initialized.data.access_code,
            reference: initialized.data.reference || reference,
            amount,
            currency
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
        Object.assign(nextBody, safePaymentFields(existing), { reviewedAt: now() });
      }
      const application = await repository.upsertApplication(nextBody);
      return response(201, { application });
    }
    if (method === 'PATCH' && parts.length === 4) {
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
