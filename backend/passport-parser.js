const parserBaseUrl = (process.env.PASSPORT_PARSER_URL || 'https://passport-parser-api.onrender.com').replace(/\/+$/, '');

function parseDataUrl(file) {
  const dataUrl = String(file && file.dataUrl || '');
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.*)$/);
  if (!match) throw new Error('Passport image must be sent as a data URL.');
  return {
    type: match[1] || file.type || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64')
  };
}

async function parsePassport(body) {
  if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
    throw new Error('Passport parsing requires Node.js 20 or newer.');
  }

  const file = body.file || body.passportImage;
  if (!file || !file.dataUrl) throw new Error('Passport image is required.');

  const parsedFile = parseDataUrl(file);
  if (!/^image\/(jpeg|png|webp)$/i.test(parsedFile.type)) {
    throw new Error('Passport image must be a JPG, PNG or WEBP file.');
  }

  const form = new FormData();
  form.append('file', new Blob([parsedFile.buffer], { type: parsedFile.type }), file.name || 'passport-image');
  if (body.travelDate) form.append('travelDate', String(body.travelDate));

  const response = await fetch(`${parserBaseUrl}/api/parse`, {
    method: 'POST',
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.error === 'string' ? data.error : `Passport parser failed with status ${response.status}.`;
    throw new Error(message);
  }
  return data;
}

module.exports = {
  parsePassport
};
