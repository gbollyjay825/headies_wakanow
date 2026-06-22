const PAYSTACK_BASE_URL = (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').replace(/\/+$/, '');
const VISA_FEE_NAIRA = Number(process.env.VISA_FEE_NAIRA || 350000);
const VISA_FEE_KOBO = VISA_FEE_NAIRA * 100;

function parseApplicants(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function calculateVisaAmountKobo(applicants) {
  return parseApplicants(applicants) * VISA_FEE_KOBO;
}

function makePaymentReference(applicationId) {
  const safeId = String(applicationId || 'visa').replace(/[^a-zA-Z0-9.-=]/g, '').slice(0, 24) || 'visa';
  return `hwvisa-${safeId}-${Date.now().toString(36)}`;
}

function cleanCallbackUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

async function paystackRequest(path, init = {}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new Error('Paystack secret key is not configured.');

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === false) {
    throw new Error(data.message || `Paystack request failed with status ${response.status}.`);
  }
  return data;
}

async function initializePaystackTransaction(payload) {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function verifyPaystackTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET'
  });
}

module.exports = {
  VISA_FEE_NAIRA,
  calculateVisaAmountKobo,
  cleanCallbackUrl,
  initializePaystackTransaction,
  makePaymentReference,
  parseApplicants,
  verifyPaystackTransaction
};
