const nodemailer = require('nodemailer');

const DEFAULT_RECIPIENTS = [
  'ifeyinwao@wakanow.com',
  'holidays@wakanow.com'
];

function cleanHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function recipients() {
  const configured = String(process.env.TRAVEL_REQUEST_EMAIL_TO || '')
    .split(/[;,]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? [...new Set(configured)] : DEFAULT_RECIPIENTS;
}

function detailsFor(request) {
  return (Array.isArray(request.details) ? request.details : [])
    .filter((detail) => Array.isArray(detail) && detail.length >= 2)
    .map(([label, value]) => [String(label || 'Detail'), String(value || '-')]);
}

function formatTravelRequestEmail(request) {
  const type = cleanHeader(request.type || 'Travel');
  const name = cleanHeader(request.name || 'New customer');
  const requestId = cleanHeader(request.id || 'Pending reference');
  const submittedAt = cleanHeader(request.createdAt || new Date().toISOString());
  const details = detailsFor(request);
  const subject = `New Headies ${type.toLowerCase()} request - ${name}`;
  const adminUrl = String(process.env.PUBLIC_APP_URL || 'https://headies.wakanow.com').replace(/\/$/, '') + '/admin';
  const textDetails = details.map(([label, value]) => `${label}: ${value}`).join('\n');
  const text = [
    `A new ${type.toLowerCase()} request has been submitted on the Headies x Wakanow travel portal.`,
    '',
    `Reference: ${requestId}`,
    `Customer: ${name}`,
    `Email: ${request.email || '-'}`,
    `Phone: ${request.phone || '-'}`,
    `Summary: ${request.summary || '-'}`,
    `Submitted: ${submittedAt}`,
    '',
    textDetails,
    '',
    `Open the dashboard: ${adminUrl}`
  ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join('\n');
  const detailRows = details.length
    ? details.map(([label, value]) => `
      <tr>
        <th style="padding:10px 12px;border-bottom:1px solid #d9e0e8;text-align:left;vertical-align:top;color:#536174;font-size:12px;width:34%">${escapeHtml(label)}</th>
        <td style="padding:10px 12px;border-bottom:1px solid #d9e0e8;color:#172033;font-size:14px;line-height:1.5">${escapeHtml(value)}</td>
      </tr>`).join('')
    : '<tr><td style="padding:12px;color:#536174">No additional details supplied.</td></tr>';
  const html = `
    <div style="margin:0;background:#f2f5f8;padding:24px;font-family:Arial,sans-serif;color:#172033">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d9e0e8">
        <div style="padding:22px 24px;background:#08111f;color:#ffffff;border-bottom:4px solid #ff7e1f">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ffb476">Headies x Wakanow travel desk</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25">New ${escapeHtml(type.toLowerCase())} request</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 18px;color:#536174;line-height:1.55">A customer has submitted a new request through the travel portal.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #d9e0e8">
            <tr><th style="padding:10px 12px;text-align:left;color:#536174;font-size:12px;width:34%">Reference</th><td style="padding:10px 12px;font-size:14px">${escapeHtml(requestId)}</td></tr>
            <tr><th style="padding:10px 12px;text-align:left;color:#536174;font-size:12px">Customer</th><td style="padding:10px 12px;font-size:14px"><strong>${escapeHtml(name)}</strong></td></tr>
            <tr><th style="padding:10px 12px;text-align:left;color:#536174;font-size:12px">Email</th><td style="padding:10px 12px;font-size:14px">${escapeHtml(request.email || '-')}</td></tr>
            <tr><th style="padding:10px 12px;text-align:left;color:#536174;font-size:12px">Phone</th><td style="padding:10px 12px;font-size:14px">${escapeHtml(request.phone || '-')}</td></tr>
            <tr><th style="padding:10px 12px;text-align:left;color:#536174;font-size:12px">Summary</th><td style="padding:10px 12px;font-size:14px">${escapeHtml(request.summary || '-')}</td></tr>
            <tr><th style="padding:10px 12px;text-align:left;color:#536174;font-size:12px">Submitted</th><td style="padding:10px 12px;font-size:14px">${escapeHtml(submittedAt)}</td></tr>
          </table>
          <h2 style="margin:24px 0 10px;font-size:17px">Request details</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #d9e0e8">${detailRows}</table>
          <p style="margin:22px 0 0"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 16px;background:#126bc5;color:#ffffff;text-decoration:none;font-weight:700">Open travel dashboard</a></p>
        </div>
      </div>
    </div>`;

  return { subject, text, html, adminUrl };
}

function senderAddress() {
  return cleanHeader(
    process.env.TRAVEL_REQUEST_EMAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    ''
  );
}

function replyToAddress(value) {
  const email = cleanHeader(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

async function sendWithResend(message, to, from, request) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: replyToAddress(request.email),
      subject: message.subject,
      text: message.text,
      html: message.html
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Email provider returned ${response.status}.`);
  return { provider: 'resend', messageId: String(data.id || '') };
}

async function sendWithSmtp(message, to, from, request) {
  const port = Number(process.env.SMTP_PORT || 587);
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const password = String(process.env.SMTP_PASSWORD || '').trim();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    requireTLS: String(process.env.SMTP_REQUIRE_TLS || 'true').toLowerCase() !== 'false',
    name: String(process.env.SMTP_HELO_NAME || 'headies.wakanow.com').trim(),
    auth: user ? { user, pass: password } : undefined,
    tls: { servername: host },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });
  const result = await transporter.sendMail({
    from,
    to,
    replyTo: replyToAddress(request.email),
    subject: message.subject,
    text: message.text,
    html: message.html
  });
  return { provider: 'smtp', messageId: String(result.messageId || '') };
}

function safeError(error) {
  return String(error && error.message ? error.message : 'Email delivery failed.')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 240);
}

async function sendTravelRequestEmail(request) {
  const to = recipients();
  const from = senderAddress();
  const attemptedAt = new Date().toISOString();
  if (!from || (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST)) {
    return {
      status: 'not_configured',
      recipients: to,
      attemptedAt,
      error: 'Travel request email provider is not configured.'
    };
  }

  try {
    const message = formatTravelRequestEmail(request);
    const delivery = process.env.RESEND_API_KEY
      ? await sendWithResend(message, to, from, request)
      : await sendWithSmtp(message, to, from, request);
    return {
      status: 'sent',
      recipients: to,
      attemptedAt,
      sentAt: new Date().toISOString(),
      ...delivery
    };
  } catch (error) {
    return {
      status: 'failed',
      recipients: to,
      attemptedAt,
      error: safeError(error)
    };
  }
}

module.exports = {
  DEFAULT_RECIPIENTS,
  formatTravelRequestEmail,
  sendTravelRequestEmail
};
