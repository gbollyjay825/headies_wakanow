const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headies-staff-submit-'));
const storeFile = path.join(testDir, 'store.json');

delete process.env.DATABASE_URL;
process.env.SUPER_ADMIN_PASSCODE = 'TEST-SUPER';
process.env.WKN_STORE_FILE = storeFile;

const requiredFields = [
  'applicationForm',
  'familyInformationForm',
  'resume',
  'passport',
  'previousVisas',
  'bankStatements',
  'taxClearance'
];

function uploads(prefix) {
  return requiredFields.map((field) => ({
    field,
    document: field,
    required: true,
    files: [{
      id: `doc-${prefix}-${field}`,
      name: `${field}.pdf`,
      size: 1,
      type: 'application/pdf',
      dataUrl: 'data:application/pdf;base64,WA=='
    }]
  }));
}

function application(id, email, userType) {
  return {
    id,
    applicantId: id,
    name: `${userType} Applicant`,
    email,
    phone: '08000000000',
    applicants: '1',
    applicantCategory: '',
    userType,
    passportExpiry: '2028-12-31',
    travelDate: '',
    travelHistory: '',
    role: '',
    salary: '',
    employmentLength: '',
    notes: '',
    fee: 'Visa package',
    status: 'Draft',
    paymentStatus: 'Unpaid',
    paymentReference: '',
    paymentAmount: 0,
    paymentCurrency: 'NGN',
    paymentPaidAt: '',
    reviewedAt: '',
    passportDetails: null,
    reviewConfirmed: false,
    uploads: uploads(id),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

const staffApplication = application('staff-1', 'staff@example.com', 'basic');
const patchStaffApplication = application('staff-patch-1', 'staff-patch@example.com', 'basic');
const basicApplication = application('basic-1', 'basic@example.com', 'basic');

fs.writeFileSync(storeFile, JSON.stringify({
  requests: [],
  eligibleApplicants: [
    {
      id: 'staff-1',
      name: 'Staff Applicant',
      email: 'staff@example.com',
      phone: '08000000000',
      category: '',
      userType: 'staff',
      status: 'active'
    },
    {
      id: 'staff-patch-1',
      name: 'Patch Staff Applicant',
      email: 'staff-patch@example.com',
      phone: '08000000000',
      category: '',
      userType: 'staff',
      status: 'active'
    },
    {
      id: 'basic-1',
      name: 'Basic Applicant',
      email: 'basic@example.com',
      phone: '08000000000',
      category: '',
      userType: 'basic',
      status: 'active'
    }
  ],
  visaApplications: [staffApplication, patchStaffApplication, basicApplication]
}, null, 2));

const { handleApi } = require('../backend/api');
const superAdminRequest = { headers: { 'x-super-admin-code': 'TEST-SUPER' } };

after(() => fs.rmSync(testDir, { recursive: true, force: true }));

test('submission requires the IMM 5645 family information form', async () => {
  const result = await handleApi('POST', '/api/visa/applications', {
    ...staffApplication,
    uploads: staffApplication.uploads.filter((upload) => upload.field !== 'familyInformationForm'),
    status: 'Submitted',
    reviewConfirmed: true
  });

  assert.equal(result.status, 400);
  assert.match(result.data.error, /IMM 5645 family information form/i);
});

test('active staff applicant submits without card payment and records a waiver', async () => {
  const result = await handleApi('POST', '/api/visa/applications', {
    ...staffApplication,
    uploads: undefined,
    status: 'Submitted',
    reviewConfirmed: true
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.application.status, 'Submitted');
  assert.equal(result.data.application.userType, 'staff');
  assert.equal(result.data.application.paymentStatus, 'Paid');
  assert.equal(result.data.application.paymentAmount, 0);
  assert.match(result.data.application.paymentReference, /^staff-/);
  assert.match(result.data.application.fee, /no payment required/i);
});

test('unpaid basic applicant cannot bypass payment by claiming staff type', async () => {
  const result = await handleApi('POST', '/api/visa/applications', {
    ...basicApplication,
    uploads: undefined,
    userType: 'staff',
    status: 'Submitted',
    reviewConfirmed: true
  });

  assert.equal(result.status, 402);
  assert.match(result.data.error, /verified payment is required/i);
});

test('staff waiver also applies to the application status update route', async () => {
  const result = await handleApi(
    'PATCH',
    '/api/visa/applications/staff-patch-1',
    { status: 'Submitted' },
    superAdminRequest
  );

  assert.equal(result.status, 200);
  assert.equal(result.data.application.status, 'Submitted');
  assert.equal(result.data.application.userType, 'staff');
  assert.equal(result.data.application.paymentStatus, 'Paid');
  assert.equal(result.data.application.paymentAmount, 0);
  assert.match(result.data.application.paymentReference, /^staff-/);
});
