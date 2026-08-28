const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headies-superadmin-applications-'));
const storeFile = path.join(testDir, 'store.json');

delete process.env.DATABASE_URL;
process.env.ADMIN_PASSCODE = 'TEST-ADMIN';
process.env.SUPER_ADMIN_PASSCODE = 'TEST-SUPER';
process.env.WKN_STORE_FILE = storeFile;

fs.writeFileSync(storeFile, JSON.stringify({
  requests: [],
  eligibleApplicants: [],
  visaApplications: [
    {
      id: 'visa-submitted-1',
      applicantId: 'applicant-1',
      name: 'Submitted Applicant',
      email: 'submitted@example.com',
      phone: '08000000000',
      applicants: '1',
      applicantCategory: 'employed',
      userType: 'basic',
      status: 'Submitted',
      paymentStatus: 'Paid',
      paymentReference: 'PAY-1',
      uploads: [
        {
          field: 'applicationForm',
          document: 'Completed IMM 5257 application form',
          required: true,
          files: [
            {
              id: 'document-1',
              name: 'application.pdf',
              size: 1,
              type: 'application/pdf',
              dataUrl: 'data:application/pdf;base64,WA=='
            }
          ]
        }
      ],
      createdAt: '2026-08-27T08:00:00.000Z',
      updatedAt: '2026-08-27T08:00:00.000Z'
    }
  ]
}, null, 2));

const { handleApi } = require('../backend/api');

after(() => fs.rmSync(testDir, { recursive: true, force: true }));

const adminRequest = { headers: { 'x-super-admin-code': 'TEST-ADMIN' } };
const superAdminRequest = { headers: { 'x-super-admin-code': 'TEST-SUPER' } };

test('only superadmin can list visa applications and the list omits file payloads', async () => {
  const anonymous = await handleApi('GET', '/api/visa/applications');
  const regularAdmin = await handleApi('GET', '/api/visa/applications', {}, adminRequest);
  const superAdmin = await handleApi('GET', '/api/visa/applications', {}, superAdminRequest);

  assert.equal(anonymous.status, 403);
  assert.equal(regularAdmin.status, 403);
  assert.equal(superAdmin.status, 200);
  assert.equal(superAdmin.data.applications.length, 1);
  assert.equal(superAdmin.data.applications[0].status, 'Submitted');
  assert.equal(superAdmin.data.applications[0].uploads[0].files[0].dataUrl, undefined);
});

test('only superadmin can download a document scoped to its application', async () => {
  const pathname = '/api/visa/applications/visa-submitted-1/documents/document-1';
  const anonymous = await handleApi('GET', pathname);
  const regularAdmin = await handleApi('GET', pathname, {}, adminRequest);
  const superAdmin = await handleApi('GET', pathname, {}, superAdminRequest);
  const wrongApplication = await handleApi(
    'GET',
    '/api/visa/applications/another-application/documents/document-1',
    {},
    superAdminRequest
  );

  assert.equal(anonymous.status, 403);
  assert.equal(regularAdmin.status, 403);
  assert.equal(superAdmin.status, 200);
  assert.equal(superAdmin.data.__binaryFile.name, 'application.pdf');
  assert.equal(superAdmin.data.__binaryFile.type, 'application/pdf');
  assert.equal(superAdmin.data.__binaryFile.data.toString('utf8'), 'X');
  assert.equal(wrongApplication.status, 404);
});

test('only superadmin can set review statuses and invalid statuses are rejected', async () => {
  const pathname = '/api/visa/applications/visa-submitted-1';
  const anonymous = await handleApi('PATCH', pathname, { status: 'In review' });
  const anonymousSubmitted = await handleApi('PATCH', pathname, { status: 'Submitted' });
  const regularAdmin = await handleApi('PATCH', pathname, { status: 'In review' }, adminRequest);
  const invalid = await handleApi('PATCH', pathname, { status: 'Escalated' }, superAdminRequest);
  const superAdmin = await handleApi('PATCH', pathname, { status: 'In review' }, superAdminRequest);

  assert.equal(anonymous.status, 403);
  assert.equal(anonymousSubmitted.status, 403);
  assert.equal(regularAdmin.status, 403);
  assert.equal(invalid.status, 400);
  assert.equal(superAdmin.status, 200);
  assert.equal(superAdmin.data.application.status, 'In review');
});
