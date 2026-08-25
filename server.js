const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApi } = require('./backend/api');

const root = __dirname;
const angularRoot = path.join(root, 'dist', 'headies-wakanow', 'browser');
const staticRoot = fs.existsSync(angularRoot) ? angularRoot : root;
const port = Number(process.env.PORT || 8756);
const maxBodyBytes = 35 * 1024 * 1024;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function sendBinaryFile(res, status, file) {
  // ASCII-only fallback: Node rejects header values with code units > 0xFF.
  // Full UTF-8 names travel in the filename* parameter below.
  const safeName = String(file.name || 'document').replace(/[^\x20-\x7E]|["\\]/g, '_');
  res.writeHead(status, {
    'content-type': file.type || 'application/octet-stream',
    'content-length': file.data.length,
    'content-disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(String(file.name || 'document'))}`
  });
  res.end(file.data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
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

function staticPath(pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const requestPath = decoded === '/' ? '/index.html' : decoded;
  const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(staticRoot, normalized);
  return filePath.startsWith(staticRoot) ? filePath : null;
}

function sendStatic(req, res, pathname) {
  const filePath = staticPath(pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      const ext = path.extname(filePath);
      const canFallbackToSpa = staticRoot === angularRoot && (!ext || ext === '.html');
      if (canFallbackToSpa) {
        const fallback = path.join(staticRoot, 'index.html');
        res.writeHead(200, { 'content-type': mimeTypes['.html'], 'cache-control': 'no-cache' });
        fs.createReadStream(fallback).pipe(res);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'content-type': mimeTypes[ext] || 'application/octet-stream' };
    // HTML must always revalidate so clients pick up new hashed bundles right after a deploy.
    if (ext === '.html' || !ext) headers['cache-control'] = 'no-cache';
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,x-super-admin-code'
    });
    res.end();
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
      const result = await handleApi(req.method, url.pathname, body, req);
      if (result && result.data && result.data.__binaryFile) {
        sendBinaryFile(res, result.status, result.data.__binaryFile);
        return;
      }
      sendJson(res, result ? result.status : 404, result ? result.data : { error: 'API route not found' });
    } catch (error) {
      sendJson(res, error.message === 'Payload too large' ? 413 : 400, { error: error.message });
    }
    return;
  }

  sendStatic(req, res, url.pathname);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Headies x Wakanow app running at http://127.0.0.1:${port}/`);
});
