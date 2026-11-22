/* Local test server: serves public/ and the three endpoints.
   Run: MOCK_STRIPE=1 TEST_MODE=1 node tools/dev-server.js  ->  http://localhost:8888 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { report, checkout, gift } = require('../lib/server.js');

const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css' };
const PORT = +process.env.PORT || 8888;
if (!process.env.SITE_URL) process.env.SITE_URL = 'http://localhost:' + PORT;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', async () => {
      const fn = url.pathname === '/api/report' ? report : url.pathname === '/api/checkout' ? checkout : url.pathname === '/api/gift' ? gift : null;
      if (!fn) { res.writeHead(404); res.end(); return; }
      const out = await fn({ httpMethod: req.method, body, headers: { host: req.headers.host } });
      res.writeHead(out.statusCode, out.headers); res.end(out.body);
    });
    return;
  }
  let p = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log('http://localhost:' + PORT));
