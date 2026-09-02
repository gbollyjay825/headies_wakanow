const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headies-nominee-visa-'));
const storeFile = path.join(testDir, 'store.json');
const originalNomineeFee = process.env.VISA_NOMINEE_FEE_NAIRA;

delete process.env.DATABASE_URL;
delete process.env.VISA_NOMINEE_FEE_NAIRA;
process.env.ADMIN_PASSCODE = 'TEST-ADMIN';
process.env.SUPER_ADMIN_PASSCODE = 'TEST-SUPER';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_nominee';
process.env.WKN_STORE_FILE = storeFile;

fs.writeFileSync(storeFile, JSON.stringify({
  requests: [],
  eligibleApplicants: [],
  visaApplications: []
}, null, 2));

const originalFetch = global.fetch;
const paystackRequests = [];
global.fetch = async (url, init = {}) => {
  const request = {
    url: String(url),
    method: String(init.method || 'GET'),
    body: init.body ? JSON.parse(String(init.body)) : null
  };
  paystackRequests.push(request);
  if (request.url.includes('/transaction/verify/')) {
    const initialized = [...paystackRequests].reverse().find((item) => item.url.endsWith('/transaction/initialize'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: true,
        data: {
          status: 'success',
          amount: initialized.body.amount,
          currency: 'NGN',
          paid_at: '2026-09-02T10:00:00.000Z'
        }
      })
    };
  }
  if (!request.url.endsWith('/transaction/initialize')) throw new Error(`Unexpected Paystack URL: ${request.url}`);
  const reference = `nominee-payment-${paystackRequests.length}`;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      status: true,
      data: {
        authorization_url: 'https://checkout.paystack.test/nominee',
        access_code: 'nominee-access',
        reference
      }
    })
  };
};

const { handleApi } = require('../backend/api');
const adminRequest = { headers: { 'x-super-admin-code': 'TEST-ADMIN' } };
const superAdminRequest = { headers: { 'x-super-admin-code': 'TEST-SUPER' } };
let nomineeId = '';
let forgerId = '';
let nomineePaymentReference = '';

after(() => {
  global.fetch = originalFetch;
  delete process.env.PAYSTACK_SECRET_KEY;
  if (originalNomineeFee === undefined) delete process.env.VISA_NOMINEE_FEE_NAIRA;
  else process.env.VISA_NOMINEE_FEE_NAIRA = originalNomineeFee;
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('Nominees visa type is priced and enforced end to end', async (t) => {
  await t.test('defaults to NGN 350,000', async () => {
    const initial = await handleApi('GET', '/api/visa/pricing');
    assert.equal(initial.status, 200);
    assert.equal(initial.data.pricing.nominee, 350000);
  });

  await t.test('only superadmin can assign the type and plural input is canonicalized', async () => {
    const record = {
      name: 'Headies Nominee',
      email: 'nominee@example.com',
      phone: '08000000000',
      accessCode: 'nominee-code',
      category: '',
      userType: 'nominees',
      status: 'active'
    };
    const denied = await handleApi('POST', '/api/eligible', record, adminRequest);
    assert.equal(denied.status, 403);

    const created = await handleApi('POST', '/api/eligible', record, superAdminRequest);
    assert.equal(created.status, 201);
    const nominee = created.data.applicants.find((applicant) => applicant.email === record.email);
    assert.ok(nominee);
    assert.equal(nominee.userType, 'nominee');
    nomineeId = nominee.id;

    const second = await handleApi('POST', '/api/eligible', {
      ...record,
      name: 'Payment Forger',
      email: 'forger@example.com',
      userType: 'nominee'
    }, superAdminRequest);
    forgerId = second.data.applicants.find((applicant) => applicant.email === 'forger@example.com').id;

    const login = await handleApi('POST', '/api/eligible/login', {
      email: record.email,
      accessCode: record.accessCode
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.applicant.userType, 'nominee');
  });

  await t.test('ignores client-supplied paid fields on public application saves', async () => {
    const forged = await handleApi('POST', '/api/visa/applications', {
      id: forgerId,
      applicantId: forgerId,
      name: 'Payment Forger',
      email: 'forger@example.com',
      applicants: '1',
      userType: 'nominee',
      status: 'Draft',
      paymentStatus: 'Paid',
      paymentReference: 'forged-reference',
      paymentAmount: 35000000,
      paymentCurrency: 'NGN',
      paymentPaidAt: '2026-09-02T09:00:00.000Z'
    });

    assert.equal(forged.status, 201);
    assert.equal(forged.data.application.paymentStatus, 'Unpaid');
    assert.equal(forged.data.application.paymentReference, '');
    assert.equal(forged.data.application.paymentAmount, 0);

    const submission = await handleApi('POST', '/api/visa/applications', {
      ...forged.data.application,
      status: 'Submitted',
      reviewConfirmed: true
    });
    assert.equal(submission.status, 402);
    assert.match(submission.data.error, /verified payment is required/i);
  });

  await t.test('charges NGN 350,000 per applicant from the allowlist type', async () => {
    const initialize = await handleApi('POST', '/api/payments/paystack/initialize', {
      id: nomineeId,
      applicantId: nomineeId,
      applicationId: nomineeId,
      name: 'Headies Nominee',
      email: 'nominee@example.com',
      applicants: '2',
      userType: 'staff',
      callbackUrl: 'https://headies.wakanow.com/visa'
    });

    assert.equal(initialize.status, 200);
    assert.equal(paystackRequests.length, 1);
    assert.equal(paystackRequests[0].method, 'POST');
    assert.match(paystackRequests[0].url, /\/transaction\/initialize$/);
    assert.equal(paystackRequests[0].body.amount, 70000000);
    assert.equal(paystackRequests[0].body.metadata.userType, 'nominee');
    assert.equal(initialize.data.payment.amount, 70000000);
    assert.equal(initialize.data.payment.userType, 'nominee');
    assert.equal(initialize.data.payment.staff, false);
    assert.equal(initialize.data.application.userType, 'nominee');
    assert.equal(initialize.data.application.paymentAmount, 70000000);
    assert.match(initialize.data.application.fee, /Nominees visa only/i);
    assert.match(initialize.data.application.fee, /admin processing and Headies ticket fees not included/i);
    nomineePaymentReference = initialize.data.payment.reference;

    const persisted = await handleApi('GET', `/api/visa/applications/${nomineeId}`);
    assert.equal(persisted.status, 200);
    assert.equal(persisted.data.application.userType, 'nominee');
    assert.equal(persisted.data.application.paymentStatus, 'Pending');
    assert.equal(persisted.data.application.paymentAmount, 70000000);
    assert.match(persisted.data.application.fee, /Nominees visa only/i);
  });

  await t.test('cannot use a client-supplied staff type to bypass payment', async () => {
    const submission = await handleApi('POST', '/api/visa/applications', {
      id: nomineeId,
      applicantId: nomineeId,
      name: 'Headies Nominee',
      email: 'nominee@example.com',
      applicants: '2',
      userType: 'staff',
      status: 'Submitted',
      reviewConfirmed: true
    });

    assert.equal(submission.status, 402);
    assert.match(submission.data.error, /verified payment is required/i);
  });

  await t.test('locks applicant count and type while payment is pending', async () => {
    const changedApplicant = await handleApi('POST', '/api/visa/applications', {
      id: nomineeId,
      applicantId: forgerId,
      name: 'Payment Forger',
      email: 'forger@example.com',
      applicants: '2',
      status: 'Draft'
    });
    assert.equal(changedApplicant.status, 409);
    assert.match(changedApplicant.data.error, /applicant assigned.*cannot be changed/i);

    const changedCount = await handleApi('POST', '/api/visa/applications', {
      id: nomineeId,
      applicantId: nomineeId,
      name: 'Headies Nominee',
      email: 'nominee@example.com',
      applicants: '3',
      status: 'Draft'
    });
    assert.equal(changedCount.status, 409);
    assert.match(changedCount.data.error, /applicant count changed after payment started/i);

    await handleApi(
      'PATCH',
      `/api/eligible/${nomineeId}`,
      { userType: 'basic' },
      superAdminRequest
    );
    const changedType = await handleApi('POST', '/api/visa/applications', {
      id: nomineeId,
      applicantId: nomineeId,
      name: 'Headies Nominee',
      email: 'nominee@example.com',
      applicants: '2',
      status: 'Draft'
    });
    assert.equal(changedType.status, 409);
    assert.match(changedType.data.error, /assigned visa type changed after payment started/i);

    await handleApi(
      'PATCH',
      `/api/eligible/${nomineeId}`,
      { userType: 'nominee' },
      superAdminRequest
    );
  });

  await t.test('locks the paid applicant count and assigned visa type', async () => {
    const verified = await handleApi('POST', '/api/payments/paystack/verify', {
      reference: nomineePaymentReference
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.data.payment.verified, true);

    const paystackRequestsBeforeReinitialization = paystackRequests.length;
    const changedApplicant = await handleApi('POST', '/api/payments/paystack/initialize', {
      id: nomineeId,
      applicationId: nomineeId,
      applicantId: forgerId,
      email: 'forger@example.com',
      applicants: '2'
    });
    assert.equal(changedApplicant.status, 409);
    assert.match(changedApplicant.data.error, /applicant assigned.*cannot be changed/i);

    const duplicatePayment = await handleApi('POST', '/api/payments/paystack/initialize', {
      id: nomineeId,
      applicationId: nomineeId,
      applicantId: nomineeId,
      email: 'nominee@example.com',
      applicants: '2'
    });
    assert.equal(duplicatePayment.status, 409);
    assert.match(duplicatePayment.data.error, /already has a verified payment/i);
    assert.equal(paystackRequests.length, paystackRequestsBeforeReinitialization);

    const unchanged = await handleApi('GET', `/api/visa/applications/${nomineeId}`);
    assert.equal(unchanged.data.application.applicantId, nomineeId);
    assert.equal(unchanged.data.application.paymentStatus, 'Paid');
    assert.equal(unchanged.data.application.paymentAmount, 70000000);
    assert.equal(unchanged.data.application.paymentReference, nomineePaymentReference);

    const changedCount = await handleApi('POST', '/api/visa/applications', {
      ...verified.data.application,
      applicants: '3',
      status: 'Submitted',
      reviewConfirmed: true
    });
    assert.equal(changedCount.status, 409);
    assert.match(changedCount.data.error, /applicant count changed/i);

    const changedType = await handleApi(
      'PATCH',
      `/api/eligible/${nomineeId}`,
      { userType: 'basic' },
      superAdminRequest
    );
    assert.equal(changedType.status, 200);

    const stalePayment = await handleApi('POST', '/api/visa/applications', {
      ...verified.data.application,
      status: 'Submitted',
      reviewConfirmed: true
    });
    assert.equal(stalePayment.status, 409);
    assert.match(stalePayment.data.error, /assigned visa type changed/i);

    await handleApi(
      'PATCH',
      `/api/eligible/${nomineeId}`,
      { userType: 'nominee' },
      superAdminRequest
    );
  });

  await t.test('persists pricing changes and uses them for Paystack initialization', async () => {
    try {
      const updated = await handleApi(
        'PATCH',
        '/api/visa/pricing',
        { pricing: { nominee: 351000 } },
        superAdminRequest
      );
      assert.equal(updated.status, 200);
      assert.equal(updated.data.pricing.nominee, 351000);

      const persisted = await handleApi('GET', '/api/visa/pricing');
      assert.equal(persisted.data.pricing.nominee, 351000);

      const initialize = await handleApi('POST', '/api/payments/paystack/initialize', {
        id: forgerId,
        applicantId: forgerId,
        applicationId: forgerId,
        name: 'Payment Forger',
        email: 'forger@example.com',
        applicants: '1',
        callbackUrl: 'https://headies.wakanow.com/visa'
      });
      assert.equal(initialize.status, 200);
      assert.equal(initialize.data.payment.amount, 35100000);
    } finally {
      await handleApi(
        'PATCH',
        '/api/visa/pricing',
        { pricing: { nominee: 350000 } },
        superAdminRequest
      );
    }
  });
});
