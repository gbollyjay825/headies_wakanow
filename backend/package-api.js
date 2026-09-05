const crypto = require('node:crypto');
const catalog = require('./package-catalog');
const bookings = require('./package-repository');
const { initializePaystackTransaction, verifyPaystackTransaction } = require('./paystack');

const FULFILLMENT_STATUSES = ['Awaiting payment', 'Payment received', 'Contacted', 'Confirmed', 'Cancelled'];
const reply = (status, data) => ({ status, data });
const text = (value) => typeof value === 'string' ? value.trim() : '';
const hash = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

function authorized(booking, token) {
  const expected = booking ? booking.tokenHash : hash('unavailable');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash(token), 'hex')) && Boolean(booking && text(token));
}

function publicBooking(booking) {
  return {
    id: booking.id, packageSlug: booking.packageSlug, packageName: booking.packageName,
    travellers: booking.travellers, unitPriceNaira: booking.unitPriceNaira,
    totalAmountKobo: booking.totalAmountKobo, currency: booking.currency,
    customer: booking.customer, departureCity: booking.departureCity,
    travelDate: booking.travelDate, roomPreference: booking.roomPreference, notes: booking.notes,
    reference: booking.reference, paymentStatus: booking.paymentStatus,
    fulfillmentStatus: booking.fulfillmentStatus, createdAt: booking.createdAt,
    updatedAt: booking.updatedAt, paidAt: booking.paidAt || '', packageSnapshot: booking.packageSnapshot
  };
}

function paymentSummary(booking) {
  const resumable = booking.initializationStatus === 'Ready' && booking.paymentStatus === 'Pending'
    && booking.fulfillmentStatus !== 'Cancelled';
  return {
    reference: booking.reference,
    accessCode: resumable ? booking.accessCode : '',
    authorizationUrl: resumable ? booking.authorizationUrl : '',
    verified: booking.paymentStatus === 'Paid',
    status: booking.providerStatus || booking.paymentStatus.toLowerCase()
  };
}

function validationError(body, item) {
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const fullName = text(customer.fullName);
  const email = text(customer.email).toLowerCase();
  const phone = text(customer.phone);
  if (fullName.length < 2 || fullName.length > 120) return 'Enter your full name (2–120 characters).';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (!/^[+\d\s().-]{7,32}$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 20) return 'Enter a valid phone number including your country code.';
  if (typeof body.travellers !== 'number' || !Number.isInteger(body.travellers) || body.travellers < 1 || body.travellers > 6) return 'Choose between 1 and 6 travellers.';
  if (body.termsAccepted !== true) return 'Acknowledge the package details before continuing to payment.';
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(text(body.idempotencyKey))) return 'A valid checkout session is required. Refresh this page and try again.';
  if (body.bookingToken !== undefined && !/^[a-zA-Z0-9_-]{43}$/.test(text(body.bookingToken))) return 'A valid secure booking access key is required.';
  const departureCity = text(body.departureCity);
  if (item.departureCity) {
    if (departureCity && departureCity.toLowerCase() !== item.departureCity.toLowerCase()) return 'Choose the departure city included in this package.';
  } else if (departureCity.length < 2 || departureCity.length > 120) {
    return 'Enter your preferred departure city (2–120 characters).';
  }
  if (text(body.travelDate)) {
    const date = text(body.travelDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return 'Enter a valid preferred travel date.';
  }
  if (text(body.roomPreference).length > 80) return 'Room preference must be 80 characters or fewer.';
  if (text(body.notes).length > 1000) return 'Special requests must be 1,000 characters or fewer.';
  return '';
}

function callbackUrl(slug) {
  try {
    const configured = new URL(process.env.PUBLIC_SITE_URL || process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://headies.wakanow.com');
    if (!['https:', 'http:'].includes(configured.protocol)) throw new Error('Invalid site URL');
    return `${configured.origin}/packages/${slug}?payment=return`;
  } catch {
    return `https://headies.wakanow.com/packages/${slug}?payment=return`;
  }
}

function sameBookingInput(booking, body) {
  const departureCity = text(body.departureCity) || booking.packageSnapshot.departureCity;
  return booking.packageSlug === text(body.packageSlug) && booking.travellers === body.travellers
    && booking.customer.email === text(body.customer.email).toLowerCase()
    && booking.customer.fullName === text(body.customer.fullName) && booking.customer.phone === text(body.customer.phone)
    && booking.travelDate === text(body.travelDate) && booking.roomPreference === text(body.roomPreference)
    && booking.notes === text(body.notes) && booking.departureCity.toLowerCase() === departureCity.toLowerCase();
}

async function initialize(body) {
  const item = catalog.getPackage(text(body.packageSlug));
  if (!item) return reply(404, { error: 'Package not found.' });
  const existing = await bookings.findBy('idempotencyKey', text(body.idempotencyKey));
  if (existing && !authorized(existing, body.bookingToken)) return reply(403, { error: 'Your secure booking access key is required to resume this checkout.' });
  const inputError = validationError(body, existing ? existing.packageSnapshot : item);
  if (inputError) return reply(400, { error: inputError });
  if (existing) {
    if (!sameBookingInput(existing, body)) {
      return reply(409, { error: 'This checkout already belongs to a different booking. Start a new checkout for changed details.' });
    }
    return reply(200, { booking: publicBooking(existing), payment: paymentSummary(existing), bookingToken: body.bookingToken });
  }
  if (!item.checkoutEnabled) return reply(409, { error: item.unavailableReason });
  if (!process.env.PAYSTACK_SECRET_KEY) return reply(503, { error: 'Online payment is temporarily unavailable. Please try again shortly.' });
  const totalAmountKobo = item.priceNaira * body.travellers * 100;
  if (!Number.isSafeInteger(totalAmountKobo) || totalAmountKobo <= 0) return reply(409, { error: 'This package price is not available for payment.' });
  const timestamp = new Date().toISOString();
  const bookingToken = text(body.bookingToken) || crypto.randomBytes(32).toString('base64url');
  const id = `pkg-${crypto.randomUUID()}`;
  const booking = {
    id, reference: `hwpkg-${crypto.randomBytes(18).toString('hex')}`,
    idempotencyKey: text(body.idempotencyKey), tokenHash: hash(bookingToken),
    packageSlug: item.slug, packageName: item.name, packageSnapshot: item,
    travellers: body.travellers, unitPriceNaira: item.priceNaira, totalAmountKobo, currency: 'NGN',
    customer: { fullName: text(body.customer.fullName), email: text(body.customer.email).toLowerCase(), phone: text(body.customer.phone) },
    departureCity: item.departureCity || text(body.departureCity), travelDate: text(body.travelDate),
    roomPreference: text(body.roomPreference), notes: text(body.notes), termsAcceptedAt: timestamp,
    paymentStatus: 'Pending', fulfillmentStatus: 'Awaiting payment', initializationStatus: 'Initializing',
    accessCode: '', authorizationUrl: '', providerStatus: 'pending', paidAt: '', createdAt: timestamp, updatedAt: timestamp
  };
  const saved = await bookings.create(booking);
  if (!saved.created) {
    if (!authorized(saved.booking, bookingToken)) return reply(403, { error: 'Your secure booking access key is required to resume this checkout.' });
    if (!sameBookingInput(saved.booking, body)) return reply(409, { error: 'This checkout already belongs to a different booking. Start a new checkout for changed details.' });
    return reply(200, { booking: publicBooking(saved.booking), payment: paymentSummary(saved.booking), bookingToken });
  }
  try {
    const initialized = await initializePaystackTransaction({
      email: booking.customer.email, amount: totalAmountKobo, currency: 'NGN', reference: booking.reference,
      callback_url: callbackUrl(item.slug),
      metadata: { purpose: 'travel-package', bookingId: id, packageSlug: item.slug, travellers: body.travellers }
    });
    const data = initialized.data || {};
    const paymentUrl = new URL(String(data.authorization_url || ''));
    if (data.reference !== booking.reference || !text(data.access_code) || paymentUrl.protocol !== 'https:' || !/(^|\.)paystack\.(com|co)$/.test(paymentUrl.hostname)) {
      throw new Error('Unexpected checkout response');
    }
    const updated = await bookings.update(id, (current) => ({
      ...current, initializationStatus: 'Ready', accessCode: data.access_code, authorizationUrl: data.authorization_url
    }));
    return reply(201, { booking: publicBooking(updated), payment: paymentSummary(updated), bookingToken });
  } catch {
    const updated = await bookings.update(id, (current) => ({ ...current, initializationStatus: 'Uncertain' }));
    return reply(502, {
      error: 'We could not open the payment window. Your booking has been saved. Check its payment status before starting another checkout.',
      booking: publicBooking(updated), bookingToken
    });
  }
}

function transactionMatches(booking, transaction) {
  const metadata = typeof transaction.metadata === 'string'
    ? (() => { try { return JSON.parse(transaction.metadata); } catch { return {}; } })()
    : (transaction.metadata || {});
  return transaction.reference === booking.reference && transaction.currency === 'NGN'
    && Number.isSafeInteger(Number(transaction.amount)) && Number(transaction.amount) === booking.totalAmountKobo
    && metadata.purpose === 'travel-package' && metadata.bookingId === booking.id && metadata.packageSlug === booking.packageSlug;
}

async function applyTransaction(booking, transaction) {
  return bookings.update(booking.id, (current) => {
    if (current.paymentStatus === 'Paid') return current;
    const success = transaction.status === 'success';
    const failed = ['failed', 'abandoned'].includes(transaction.status);
    const paidDate = new Date(transaction.paid_at || transaction.paidAt || Date.now());
    return {
      ...current, paymentStatus: success ? 'Paid' : failed ? 'Failed' : 'Pending',
      fulfillmentStatus: success && current.fulfillmentStatus === 'Awaiting payment' ? 'Payment received' : current.fulfillmentStatus,
      paidAt: success ? (Number.isNaN(paidDate.getTime()) ? new Date().toISOString() : paidDate.toISOString()) : current.paidAt,
      providerStatus: String(transaction.status || 'pending')
    };
  });
}

async function status(body, verify) {
  const booking = text(body.reference)
    ? await bookings.findBy('reference', text(body.reference))
    : await bookings.findBy('idempotencyKey', text(body.idempotencyKey));
  if (!authorized(booking, body.bookingToken)) return reply(404, { error: 'Booking not found or secure booking access key is invalid.' });
  if (!verify || booking.paymentStatus === 'Paid') return reply(200, { booking: publicBooking(booking), payment: paymentSummary(booking) });
  let result;
  try {
    result = await verifyPaystackTransaction(booking.reference);
  } catch {
    return reply(502, { error: 'Payment status could not be confirmed yet. Please try again shortly.', booking: publicBooking(booking) });
  }
  if (!transactionMatches(booking, result.data || {})) return reply(409, { error: 'The payment details do not match this booking. Please contact the travel team.', booking: publicBooking(booking) });
  const updated = await applyTransaction(booking, result.data);
  return reply(200, { booking: publicBooking(updated), payment: paymentSummary(updated) });
}

async function webhook(req) {
  const rawBody = req && req.rawBody;
  const signature = text(req && req.headers && req.headers['x-paystack-signature']);
  if (!process.env.PAYSTACK_SECRET_KEY || !Buffer.isBuffer(rawBody) || !/^[a-fA-F0-9]{128}$/.test(signature)) return reply(401, { error: 'Invalid webhook signature.' });
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return reply(401, { error: 'Invalid webhook signature.' });
  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { return reply(400, { error: 'Invalid webhook body.' }); }
  if (event.event !== 'charge.success' || !event.data || !text(event.data.reference).startsWith('hwpkg-')) return reply(200, { received: true });
  const booking = await bookings.findBy('reference', event.data.reference);
  if (booking && event.data.status === 'success' && transactionMatches(booking, event.data)) await applyTransaction(booking, event.data);
  return reply(200, { received: true });
}

async function handlePackageApi(method, parts, body, req, requireAdmin) {
  if (parts[1] === 'packages') {
    if (method === 'GET' && parts.length === 2) return reply(200, { packages: catalog.listPackages() });
    if (method === 'GET' && parts.length === 3) {
      const item = catalog.getPackage(parts[2]);
      return item ? reply(200, { package: item }) : reply(404, { error: 'Package not found.' });
    }
  }
  if (method === 'POST' && parts.join('/') === 'api/payments/paystack/webhook') return webhook(req);
  if (parts[1] !== 'package-bookings') return null;
  if (method === 'POST' && parts.length === 3 && parts[2] === 'initialize') return initialize(body);
  if (method === 'POST' && parts.length === 3 && ['status', 'verify'].includes(parts[2])) return status(body, parts[2] === 'verify');
  if (method === 'GET' && parts.length === 2) {
    const denied = requireAdmin(body, req);
    return denied || reply(200, { bookings: (await bookings.list()).map(publicBooking) });
  }
  if (method === 'PATCH' && parts.length === 3) {
    const denied = requireAdmin(body, req);
    if (denied) return denied;
    if (!FULFILLMENT_STATUSES.includes(body.fulfillmentStatus)) return reply(400, { error: 'Choose a valid booking fulfillment status.' });
    try {
      const updated = await bookings.update(parts[2], (current) => {
        if (['Payment received', 'Contacted', 'Confirmed'].includes(body.fulfillmentStatus) && current.paymentStatus !== 'Paid') {
          throw Object.assign(new Error('A verified payment is required before confirming this booking.'), { status: 409 });
        }
        if (body.fulfillmentStatus === 'Awaiting payment' && current.paymentStatus === 'Paid') {
          throw Object.assign(new Error('This booking already has a verified payment.'), { status: 409 });
        }
        return { ...current, fulfillmentStatus: body.fulfillmentStatus };
      });
      return updated ? reply(200, { booking: publicBooking(updated) }) : reply(404, { error: 'Booking not found.' });
    } catch (error) {
      if (error.status === 409) return reply(409, { error: error.message });
      throw error;
    }
  }
  return reply(404, { error: 'API route not found.' });
}

module.exports = { handlePackageApi };
