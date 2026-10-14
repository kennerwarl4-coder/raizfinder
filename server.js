// Local development server for testing Checkout & Vercel API routes locally
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env variables if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
      if (match && !line.trim().startsWith('#')) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val.trim();
      }
    });
  }
} catch (e) {
  console.warn('Não foi possível carregar arquivo .env:', e.message);
}

const PORT = process.env.PORT || 3000;

// Load API handlers
const createPixHandler = require('./api/create-pix');
const checkPixHandler = require('./api/check-pix');
const webhookHandler = require('./api/webhook');
const metaPurchaseHandler = require('./api/meta-purchase');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Enhance res with status and json helpers (Vercel-like)
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (obj) {
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.end(JSON.stringify(obj));
    return res;
  };

  // Helper to read JSON request body
  function readBody(cb) {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = body;
      }
      req.query = parsedUrl.query;
      cb();
    });
  }

  // Routing for API endpoints
  if (pathname === '/api/create-pix') {
    return readBody(() => createPixHandler(req, res));
  }
  if (pathname === '/api/check-pix') {
    return readBody(() => checkPixHandler(req, res));
  }
  if (pathname === '/api/webhook') {
    return readBody(() => webhookHandler(req, res));
  }
  if (pathname === '/api/meta-purchase') {
    return readBody(() => metaPurchaseHandler(req, res));
  }

  // Routing for static files
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  } else if (pathname === '/checkout') {
    pathname = '/checkout.html';
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      return res.end(`<h1>404 Não Encontrado</h1><p>Arquivo ${pathname} não existe.</p>`);
    }

    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 RaizFinder Checkout Server rodando em http://localhost:${PORT}`);
  console.log(`📄 Landing Page: http://localhost:${PORT}/`);
  console.log(`💳 Checkout: http://localhost:${PORT}/checkout.html`);
});
