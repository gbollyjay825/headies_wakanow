const { handleApi } = require('../backend/api');

const maxBodyBytes = 35 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBodyBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const result = await handleApi(req.method, url.pathname, body);
    res.status(result ? result.status : 404).json(result ? result.data : { error: 'API route not found' });
  } catch (error) {
    res.status(error.message === 'Payload too large' ? 413 : 400).json({ error: error.message });
  }
};
