const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headies-package-bookings-'));
process.env.WKN_STORE_FILE = path.join(testDir, 'store.json');
process.env.ADMIN_PASSCODE = 'PACKAGE-ADMIN';
process.env.SUPER_ADMIN_PASSCODE = 'PACKAGE-SUPER';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_packages';
if (process.env.PACKAGE_TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.PACKAGE_TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
for (const key of Object.keys(process.env)) {
  if (/^PACKAGE_(?:(?:VALUE|PREMIUM|VIP)_)?(?:CHECKOUT_ENABLED|PRICE_CONFIRMED|TRAVEL_DATES|DEPARTURE_CITY|NIGHTS|TERMS|PRICE_NAIRA)$/.test(key)) delete process.env[key];
}

const originalFetch = global.fetch;
const transactions = new Map();
let initializeCalls = 0;
let failInitialize = false;
let failVerify = false;
global.fetch = async (url, init = {}) => {
  if (String(url).endsWith('/transaction/initialize')) {
    initializeCalls += 1;
    const body = JSON.parse(init.body);
    transactions.set(body.reference, { ...body, status: 'pending' });
    if (failInitialize) throw new Error('Connection interrupted');
    return { ok: true, json: async () => ({ status: true, data: {
      reference: body.reference, access_code: `access-${body.reference}`, authorization_url: `https://checkout.paystack.com/${body.reference}`
    } }) };
  }
  const reference = decodeURIComponent(String(url).split('/').pop());
  if (failVerify) throw new Error('Provider unavailable');
  const transaction = transactions.get(reference);
  if (!transaction) return { ok: false, status: 404, json: async () => ({ status: false }) };
  return { ok: true, json: async () => ({ status: true, data: transaction }) };
};

const { handleApi } = require('../backend/api');
const repository = require('../backend/package-repository');
const admin = { headers: { 'x-super-admin-code': 'PACKAGE-ADMIN' } };
const call = (method, route, body = {}, req = null) => handleApi(method, `/api/${route}`, body, req);
const session = (overrides = {}) => ({
  packageSlug: 'value', travellers: 1,
  customer: { fullName: 'Ada Example', email: 'ada@example.com', phone: '+234 801 234 5678' },
  departureCity: 'Lagos', travelDate: '2026-11-20', roomPreference: 'Twin room', notes: '', termsAccepted: true,
  idempotencyKey: crypto.randomUUID(), bookingToken: crypto.randomBytes(32).toString('base64url'), ...overrides
});
const checkout = (body = session()) => call('POST', 'package-bookings/initialize', body);
const access = (result) => ({ reference: result.data.booking.reference, bookingToken: result.data.bookingToken });
const sign = (event) => {
  const rawBody = Buffer.from(JSON.stringify(event));
  return { rawBody, headers: { 'x-paystack-signature': crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex') } };
};

after(async () => {
  global.fetch = originalFetch;
  await repository.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('guest package bookings protect pricing, recovery, payment verification and fulfillment', async (t) => {
  await t.test('catalog opens sales by default at flyer prices without inventing travel arrangements', async () => {
    const result = await call('GET', 'packages');
    assert.deepEqual(result.data.packages.map((item) => [item.slug, item.priceNaira]), [['value', 4044000], ['premium', 3398000], ['vip', 7077000]]);
    assert.ok(result.data.packages.every((item) => item.checkoutEnabled === true && item.unavailableReason === ''));
    assert.ok(result.data.packages.every((item) => item.travelDates === '' && item.departureCity === '' && item.nights === null && item.terms === ''));
    assert.equal((await call('GET', 'packages/unknown')).status, 404);
    assert.equal((await call('GET', 'packages/vip')).data.package.hotels.length, 3);
    process.env.PACKAGE_PRICE_CONFIRMED = 'false';
    assert.equal((await call('GET', 'packages/value')).data.package.checkoutEnabled, true);
    delete process.env.PACKAGE_PRICE_CONFIRMED;
    process.env.PACKAGE_CHECKOUT_ENABLED = 'false';
    assert.equal((await call('GET', 'packages/value')).data.package.checkoutEnabled, false);
    assert.equal((await checkout()).status, 409);
    process.env.PACKAGE_VALUE_CHECKOUT_ENABLED = 'true';
    assert.equal((await call('GET', 'packages/value')).data.package.checkoutEnabled, true);
    assert.equal((await call('GET', 'packages/premium')).data.package.checkoutEnabled, false);
    delete process.env.PACKAGE_VALUE_CHECKOUT_ENABLED;
    delete process.env.PACKAGE_CHECKOUT_ENABLED;
    assert.equal(initializeCalls, 0);
    Object.assign(process.env, { PACKAGE_TRAVEL_DATES: '20–25 November 2026', PACKAGE_DEPARTURE_CITY: 'Lagos', PACKAGE_NIGHTS: '5', PACKAGE_TERMS: 'Test confirmed package terms and cancellation policy.' });
    assert.equal((await call('GET', 'packages/value')).data.package.checkoutEnabled, true);
  });

  await t.test('validates customer, consent, quantities, origin, dates and session secrets', async () => {
    for (const overrides of [
      { customer: { fullName: '', email: 'invalid', phone: '' } },
      { travellers: 0 }, { travellers: 7 }, { travellers: 1.5 }, { travellers: '2' },
      { termsAccepted: false }, { departureCity: 'Abuja' }, { travelDate: '2026-02-31' },
      { bookingToken: 'guessable' }, { idempotencyKey: 'short' }, { notes: 'a'.repeat(1001) }
    ]) assert.equal((await checkout(session(overrides))).status, 400);
    assert.equal(initializeCalls, 0);
  });

  await t.test('invalid configured price overrides keep checkout closed without hiding the source price', async () => {
    for (const value of ['4,044,000', '4044000.50', '-1', '0', 'Infinity', String(Number.MAX_SAFE_INTEGER)]) {
      process.env.PACKAGE_VALUE_PRICE_NAIRA = value;
      const result = await call('GET', 'packages/value');
      assert.equal(result.data.package.priceNaira, 4044000);
      assert.equal(result.data.package.checkoutEnabled, false);
      assert.equal((await checkout()).status, 409);
    }
    assert.equal(initializeCalls, 0);
    process.env.PACKAGE_VALUE_PRICE_NAIRA = '5000000';
    const corrected = await call('GET', 'packages/value');
    assert.equal(corrected.data.package.priceNaira, 5000000);
    assert.equal(corrected.data.package.checkoutEnabled, true);
    delete process.env.PACKAGE_VALUE_PRICE_NAIRA;
    const confirmedSource = await call('GET', 'packages/value');
    assert.equal(confirmedSource.data.package.priceNaira, 4044000);
    assert.equal(confirmedSource.data.package.checkoutEnabled, true);
  });

  await t.test('open checkout records a bounded preferred origin when no departure or dates are configured', async () => {
    const keys = ['PACKAGE_DEPARTURE_CITY', 'PACKAGE_TRAVEL_DATES', 'PACKAGE_NIGHTS', 'PACKAGE_TERMS'];
    const previousSettings = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    keys.forEach((key) => delete process.env[key]);
    try {
      const before = initializeCalls;
      for (const departureCity of ['', ' ', 'A', 'A'.repeat(121)]) {
        assert.equal((await checkout(session({ departureCity }))).status, 400);
      }
      assert.equal(initializeCalls, before);
      const body = session({ departureCity: '  Abuja  ', travelDate: '' });
      const created = await checkout(body);
      assert.equal(created.status, 201);
      assert.equal(created.data.booking.departureCity, 'Abuja');
      assert.equal(created.data.booking.travelDate, '');
      assert.equal(created.data.booking.packageSnapshot.departureCity, '');
      assert.equal(created.data.booking.packageSnapshot.travelDates, '');
      assert.equal(created.data.booking.packageSnapshot.nights, null);
      assert.equal(created.data.booking.packageSnapshot.terms, '');
      assert.equal(created.data.booking.totalAmountKobo, 404400000);
      assert.equal((await checkout({ ...body, departureCity: 'Accra' })).status, 409);
      process.env.PACKAGE_DEPARTURE_CITY = 'Lagos';
      const replay = await checkout(body);
      assert.equal(replay.status, 200);
      assert.equal(replay.data.booking.id, created.data.booking.id);
      assert.equal(replay.data.booking.departureCity, 'Abuja');
      assert.equal(initializeCalls, before + 1);
    } finally {
      for (const key of keys) {
        if (previousSettings[key] === undefined) delete process.env[key];
        else process.env[key] = previousSettings[key];
      }
    }
  });

  let initial;
  let initialBody;
  await t.test('uses authoritative totals, persists immutable snapshot and supports values beyond 32-bit integers', async () => {
    initialBody = session({ packageSlug: 'vip', travellers: 6, totalAmountKobo: 1, priceNaira: 1, paymentStatus: 'Paid' });
    initial = await checkout(initialBody);
    assert.equal(initial.status, 201);
    assert.equal(initial.data.booking.totalAmountKobo, 4246200000);
    assert.equal(initial.data.booking.paymentStatus, 'Pending');
    assert.equal(initial.data.booking.fulfillmentStatus, 'Awaiting payment');
    assert.equal(initial.data.bookingToken, initialBody.bookingToken);
    const transaction = transactions.get(initial.data.booking.reference);
    assert.equal(transaction.amount, 4246200000);
    assert.equal(transaction.currency, 'NGN');
    assert.equal(transaction.metadata.bookingId, initial.data.booking.id);
    assert.equal(transaction.metadata.purpose, 'travel-package');
    const stored = await repository.findBy('id', initial.data.booking.id);
    assert.equal(stored.tokenHash, crypto.createHash('sha256').update(initialBody.bookingToken).digest('hex'));
    assert.equal(JSON.stringify(stored).includes(initialBody.bookingToken), false);
    assert.equal(initial.data.booking.packageSnapshot.nights, 5);
    process.env.PACKAGE_VIP_PRICE_NAIRA = '8000000';
    const resumed = await call('POST', 'package-bookings/status', access(initial));
    assert.equal(resumed.data.booking.totalAmountKobo, 4246200000);
    assert.equal(resumed.data.booking.packageSnapshot.priceNaira, 7077000);
    delete process.env.PACKAGE_VIP_PRICE_NAIRA;
  });

  await t.test('idempotent retries require the existing token and recover by checkout key after network loss', async () => {
    const before = initializeCalls;
    const replay = await checkout(initialBody);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.booking.id, initial.data.booking.id);
    assert.equal(initializeCalls, before);
    const { bookingToken, ...withoutToken } = initialBody;
    assert.equal((await checkout(withoutToken)).status, 403);
    assert.equal((await checkout({ ...initialBody, bookingToken: crypto.randomBytes(32).toString('base64url') })).status, 403);
    assert.equal((await checkout({ ...initialBody, travellers: 2 })).status, 409);
    assert.equal((await checkout({ ...initialBody, customer: { ...initialBody.customer, phone: '+2348022222222' } })).status, 409);
    assert.equal((await checkout({ ...initialBody, roomPreference: 'Single' })).status, 409);
    const recovered = await call('POST', 'package-bookings/status', { idempotencyKey: initialBody.idempotencyKey, bookingToken });
    assert.equal(recovered.data.booking.id, initial.data.booking.id);
    assert.equal(recovered.data.payment.accessCode, initial.data.payment.accessCode);
    assert.equal((await call('POST', 'package-bookings/status', { reference: initial.data.booking.reference })).status, 404);
    assert.equal((await call('POST', 'package-bookings/verify', { ...access(initial), bookingToken: 'wrong' })).status, 404);
  });

  await t.test('provider errors preserve a recoverable booking without recording a false failure', async () => {
    failInitialize = true;
    const body = session();
    const result = await checkout(body);
    failInitialize = false;
    assert.equal(result.status, 502);
    assert.equal(result.data.bookingToken, body.bookingToken);
    assert.equal(result.data.booking.paymentStatus, 'Pending');
    const recovered = await call('POST', 'package-bookings/status', { idempotencyKey: body.idempotencyKey, bookingToken: body.bookingToken });
    assert.equal(recovered.status, 200);
    assert.equal(recovered.data.booking.id, result.data.booking.id);
    failVerify = true;
    const unavailable = await call('POST', 'package-bookings/verify', access(result));
    failVerify = false;
    assert.equal(unavailable.status, 502);
    assert.equal(unavailable.data.booking.paymentStatus, 'Pending');
  });

  await t.test('concurrent initialization cannot bind one checkout key to conflicting customer details', async () => {
    const first = session();
    const before = initializeCalls;
    const results = await Promise.all([checkout(first), checkout({ ...first, travellers: 2 })]);
    assert.deepEqual(results.map((result) => result.status), [201, 409]);
    assert.equal(initializeCalls, before + 1);
    const stored = await repository.findBy('idempotencyKey', first.idempotencyKey);
    assert.equal(stored.travellers, 1);
  });

  await t.test('verification rejects reference, amount, currency and metadata mismatch', async () => {
    const reference = initial.data.booking.reference;
    const valid = { ...transactions.get(reference), status: 'success', paid_at: '2026-09-05T10:00:00.000Z' };
    for (const mutation of [
      { reference: 'another-reference' }, { amount: 1 }, { currency: 'USD' }, { metadata: {} },
      { metadata: { ...valid.metadata, bookingId: 'another-booking' } },
      { metadata: { ...valid.metadata, packageSlug: 'value' } }
    ]) {
      transactions.set(reference, { ...valid, ...mutation });
      assert.equal((await call('POST', 'package-bookings/verify', access(initial))).status, 409);
      assert.equal((await repository.findBy('reference', reference)).paymentStatus, 'Pending');
    }
    transactions.set(reference, valid);
    const verified = await call('POST', 'package-bookings/verify', access(initial));
    assert.equal(verified.data.payment.verified, true);
    assert.equal(verified.data.booking.paymentStatus, 'Paid');
    assert.equal(verified.data.booking.fulfillmentStatus, 'Payment received');
    assert.equal(verified.data.booking.paidAt, valid.paid_at);
    assert.equal(verified.data.payment.accessCode, '');
  });

  await t.test('failed, abandoned and pending provider results never appear as successful bookings', async () => {
    for (const [providerStatus, expectedStatus] of [['failed', 'Failed'], ['abandoned', 'Failed'], ['pending', 'Pending']]) {
      const booking = await checkout();
      const reference = booking.data.booking.reference;
      transactions.set(reference, { ...transactions.get(reference), status: providerStatus });
      const result = await call('POST', 'package-bookings/verify', access(booking));
      assert.equal(result.data.booking.paymentStatus, expectedStatus);
      assert.equal(result.data.payment.verified, false);
      assert.equal(result.data.booking.fulfillmentStatus, 'Awaiting payment');
    }
  });

  await t.test('webhooks authenticate exact raw bytes and cannot settle a mismatched booking', async () => {
    const booking = await checkout();
    const data = { ...transactions.get(booking.data.booking.reference), status: 'success', paid_at: '2026-09-05T11:00:00.000Z' };
    const event = { event: 'charge.success', data };
    assert.equal((await call('POST', 'payments/paystack/webhook', event)).status, 401);
    const wrongSignature = sign(event);
    wrongSignature.rawBody = Buffer.from(`${wrongSignature.rawBody.toString()} `);
    assert.equal((await call('POST', 'payments/paystack/webhook', event, wrongSignature)).status, 401);
    const mismatch = { event: 'charge.success', data: { ...data, amount: 1 } };
    assert.equal((await call('POST', 'payments/paystack/webhook', mismatch, sign(mismatch))).status, 200);
    assert.equal((await repository.findBy('id', booking.data.booking.id)).paymentStatus, 'Pending');
    // Parsed request bodies are deliberately ignored: only signed raw bytes are trusted.
    assert.equal((await call('POST', 'payments/paystack/webhook', { event: 'untrusted' }, sign(event))).status, 200);
    const paid = await repository.findBy('id', booking.data.booking.id);
    assert.equal(paid.paymentStatus, 'Paid');
    assert.equal(paid.fulfillmentStatus, 'Payment received');
    await call('POST', 'payments/paystack/webhook', event, sign(event));
    assert.equal((await repository.findBy('id', paid.id)).paidAt, paid.paidAt);
    const visaEvent = { event: 'charge.success', data: { ...data, reference: 'hwvisa-unrelated' } };
    assert.equal((await call('POST', 'payments/paystack/webhook', visaEvent, sign(visaEvent))).status, 200);
  });

  await t.test('a stale verification racing a success webhook cannot downgrade a paid booking', async () => {
    const booking = await checkout();
    const reference = booking.data.booking.reference;
    const pending = transactions.get(reference);
    let continueVerification;
    const previousFetch = global.fetch;
    global.fetch = async () => new Promise((resolve) => {
      continueVerification = () => resolve({ ok: true, json: async () => ({ status: true, data: { ...pending, status: 'failed' } }) });
    });
    const verification = call('POST', 'package-bookings/verify', access(booking));
    while (!continueVerification) await new Promise((resolve) => setImmediate(resolve));
    const event = { event: 'charge.success', data: { ...pending, status: 'success' } };
    await call('POST', 'payments/paystack/webhook', event, sign(event));
    continueVerification();
    const result = await verification;
    global.fetch = previousFetch;
    assert.equal(result.data.booking.paymentStatus, 'Paid');
    assert.equal(result.data.booking.fulfillmentStatus, 'Payment received');
  });

  await t.test('admin access is required and fulfillment updates cannot fabricate or erase payment', async () => {
    assert.equal((await call('GET', 'package-bookings')).status, 401);
    assert.equal((await call('PATCH', `package-bookings/${initial.data.booking.id}`, { fulfillmentStatus: 'Confirmed' })).status, 401);
    const pending = await checkout();
    for (const fulfillmentStatus of ['Payment received', 'Contacted', 'Confirmed']) {
      assert.equal((await call('PATCH', `package-bookings/${pending.data.booking.id}`, { fulfillmentStatus, paymentStatus: 'Paid' }, admin)).status, 409);
    }
    await call('PATCH', `package-bookings/${pending.data.booking.id}`, { fulfillmentStatus: 'Cancelled' }, admin);
    const cancelled = await call('POST', 'package-bookings/status', access(pending));
    assert.equal(cancelled.data.booking.fulfillmentStatus, 'Cancelled');
    assert.equal(cancelled.data.payment.accessCode, '');
    assert.equal(cancelled.data.payment.authorizationUrl, '');
    assert.equal((await call('PATCH', `package-bookings/${initial.data.booking.id}`, { fulfillmentStatus: 'Awaiting payment' }, admin)).status, 409);
    const result = await call('PATCH', `package-bookings/${initial.data.booking.id}`, { fulfillmentStatus: 'Confirmed', paymentStatus: 'Unpaid', totalAmountKobo: 1 }, admin);
    assert.equal(result.data.booking.fulfillmentStatus, 'Confirmed');
    assert.equal(result.data.booking.paymentStatus, 'Paid');
    assert.equal(result.data.booking.totalAmountKobo, 4246200000);
    const listing = await call('GET', 'package-bookings', {}, admin);
    assert.equal(listing.status, 200);
    const serialized = JSON.stringify(listing.data);
    for (const privateField of ['tokenHash', 'bookingToken', 'idempotencyKey', 'accessCode', 'authorizationUrl']) assert.equal(serialized.includes(privateField), false);
    const invalid = await call('PATCH', `package-bookings/${initial.data.booking.id}`, { fulfillmentStatus: 'Shipped' }, admin);
    assert.equal(invalid.status, 400);
  });

  await t.test('fulfillment validation uses locked current payment state when a webhook wins the race', async () => {
    const booking = await checkout();
    const reference = booking.data.booking.reference;
    const event = { event: 'charge.success', data: { ...transactions.get(reference), status: 'success' } };
    const originalUpdate = repository.update;
    let injected = false;
    repository.update = async (id, mutate) => {
      if (!injected && id === booking.data.booking.id) {
        injected = true;
        await call('POST', 'payments/paystack/webhook', event, sign(event));
      }
      return originalUpdate(id, mutate);
    };
    try {
      const result = await call('PATCH', `package-bookings/${booking.data.booking.id}`, { fulfillmentStatus: 'Awaiting payment' }, admin);
      assert.equal(result.status, 409);
      const saved = await repository.findBy('id', booking.data.booking.id);
      assert.equal(saved.paymentStatus, 'Paid');
      assert.equal(saved.fulfillmentStatus, 'Payment received');
    } finally {
      repository.update = originalUpdate;
    }
  });

  await t.test('the HTTP server preserves webhook bytes and sends private guest receipts without caching', async () => {
    const booking = await checkout();
    const reservation = http.createServer();
    await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
    });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('HTTP test server did not start')), 5000);
        child.stdout.on('data', (chunk) => {
          if (String(chunk).includes('app running at')) { clearTimeout(timeout); resolve(); }
        });
        child.once('error', (error) => { clearTimeout(timeout); reject(error); });
        child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`HTTP test server exited: ${code}`)); });
      });
      const event = { event: 'charge.success', data: { ...transactions.get(booking.data.booking.reference), status: 'success', custom_label: 'Toronto · São Paulo' } };
      const rawBody = Buffer.from(JSON.stringify(event, null, 2));
      const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
      const response = await originalFetch(`http://127.0.0.1:${port}/api/payments/paystack/webhook`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': signature }, body: rawBody
      });
      assert.equal(response.status, 200);
      const receipt = await originalFetch(`http://127.0.0.1:${port}/api/package-bookings/status`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(access(booking))
      });
      assert.equal(receipt.headers.get('cache-control'), 'private, no-store');
      assert.equal((await receipt.json()).booking.paymentStatus, 'Paid');
    } finally {
      if (child.exitCode === null) {
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill('SIGTERM');
        await exited;
      }
    }
  });
});
