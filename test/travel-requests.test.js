const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headies-travel-requests-'));
const storeFile = path.join(testDir, 'store.json');

delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.TRAVEL_REQUEST_EMAIL_FROM;
process.env.ADMIN_PASSCODE = 'TEST-ADMIN';
process.env.WKN_STORE_FILE = storeFile;

fs.writeFileSync(storeFile, JSON.stringify({
  requests: [],
  eligibleApplicants: [],
  visaApplications: []
}, null, 2));

const { handleApi } = require('../backend/api');
const { DEFAULT_RECIPIENTS, formatTravelRequestEmail } = require('../backend/travel-request-email');
const { sendTravelRequestEmail } = require('../backend/travel-request-email');

after(() => fs.rmSync(testDir, { recursive: true, force: true }));

const adminRequest = {
  headers: { 'x-super-admin-code': 'TEST-ADMIN' }
};

test('travel request is saved before an unavailable email provider is reported', async () => {
  const result = await handleApi('POST', '/api/requests', {
    type: 'Travel',
    name: 'Ada Traveller',
    email: 'ADA@example.com',
    phone: '08000000000',
    summary: 'Business Class / 5-star hotel',
    details: [
      ['Flight type', 'Commercial Flight'],
      ['Transfer dates', '2026-09-01 -> 2026-09-05']
    ]
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.request.email, 'ada@example.com');
  assert.equal(result.data.request.metadata.notification.status, 'not_configured');
  assert.deepEqual(result.data.request.metadata.notification.recipients, DEFAULT_RECIPIENTS);

  const list = await handleApi('GET', '/api/requests', {}, adminRequest);
  assert.equal(list.status, 200);
  assert.equal(list.data.requests.length, 1);
  assert.equal(list.data.requests[0].details[1][1], '2026-09-01 -> 2026-09-05');
});

test('travel request dashboard endpoints require admin access and validate statuses', async () => {
  const denied = await handleApi('GET', '/api/requests', {});
  assert.equal(denied.status, 401);

  const list = await handleApi('GET', '/api/requests', {}, adminRequest);
  const id = list.data.requests[0].id;
  const invalid = await handleApi('PATCH', `/api/requests/${id}`, { status: 'Anything' }, adminRequest);
  assert.equal(invalid.status, 400);

  const updated = await handleApi('PATCH', `/api/requests/${id}`, { status: 'Contacted' }, adminRequest);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.request.status, 'Contacted');
  assert.equal(updated.data.request.metadata.notification.status, 'not_configured');
});

test('travel request email includes full details and escapes customer content', () => {
  const message = formatTravelRequestEmail({
    id: 'req-123',
    type: 'Luxury',
    name: '<script>alert(1)</script>',
    email: 'guest@example.com',
    phone: '08000000000',
    summary: 'Private jet',
    details: [['Services', 'Private jet, Airport protocol']],
    createdAt: '2026-07-15T19:00:00.000Z'
  });

  assert.match(message.subject, /luxury request/i);
  assert.match(message.text, /Private jet, Airport protocol/);
  assert.doesNotMatch(message.html, /<script>alert/);
  assert.match(message.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(message.html, /https:\/\/headies\.wakanow\.com\/admin/);
});

test('SMTP delivery sends one request to both travel team recipients', async () => {
  let received = '';
  let finishMessage;
  const messageReceived = new Promise((resolve) => { finishMessage = resolve; });
  const server = net.createServer((socket) => {
    let buffer = '';
    let inData = false;
    socket.write('220 localhost ESMTP test\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let lineEnd;
      while ((lineEnd = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        received += `${line}\n`;
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 2.0.0 queued\r\n');
            finishMessage();
          }
        } else if (/^EHLO /i.test(line)) {
          socket.write('250-localhost\r\n250 SIZE 10485760\r\n');
        } else if (/^MAIL FROM:/i.test(line) || /^RCPT TO:/i.test(line)) {
          socket.write('250 2.1.5 OK\r\n');
        } else if (line === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 2.0.0 bye\r\n');
        } else if (line) {
          socket.write('250 OK\r\n');
        }
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(address.port);
  process.env.SMTP_REQUIRE_TLS = 'false';
  process.env.TRAVEL_REQUEST_EMAIL_FROM = 'Headies Travel Desk <no-reply@headies.wakanow.com>';
  try {
    const result = await sendTravelRequestEmail({
      id: 'req-smtp',
      type: 'Travel',
      name: 'SMTP Test',
      email: 'guest@example.com',
      phone: '08000000000',
      summary: 'Economy / 4-star hotel',
      details: [['Flight type', 'Commercial Flight']],
      createdAt: '2026-07-15T19:00:00.000Z'
    });
    await messageReceived;
    assert.equal(result.status, 'sent');
    assert.equal(result.provider, 'smtp');
    assert.match(received, /RCPT TO:<ifeyinwao@wakanow\.com>/i);
    assert.match(received, /RCPT TO:<holidays@wakanow\.com>/i);
    assert.match(received, /New Headies travel request/i);
  } finally {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_REQUIRE_TLS;
    delete process.env.TRAVEL_REQUEST_EMAIL_FROM;
    await new Promise((resolve) => server.close(resolve));
  }
});
