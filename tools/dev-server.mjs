// =============================================================
// Local server that imitates Vercel: serves the static files and
// runs the functions in /api exactly like Vercel does.
//
// Usage (from the repository root):
//   DATABASE_URL=postgres://postgres@127.0.0.1:5432/lagoa \
//   ADMIN_PASSWORD=a-long-test-password \
//   node tools/dev-server.mjs web-profesional
// Then open http://localhost:3077 and http://localhost:3077/admin
// =============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.argv[2] || 'web-profesional');
const PORT = Number(process.env.PORT || 3077);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json'
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // /api/... → run the matching function file (files and folders starting with _ are private)
  if (url.pathname.startsWith('/api/')) {
    const rel = url.pathname.replace(/\/$/, '');
    let file = path.join(ROOT, rel + '.js');
    if (!fs.existsSync(file)) file = path.join(ROOT, rel, 'index.js');
    if (!fs.existsSync(file) || rel.split('/').some(p => p.startsWith('_'))) {
      res.statusCode = 404;
      return res.end('{"error":"Not found"}');
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if ((req.headers['content-type'] || '').includes('application/json') && raw) {
      try { req.body = JSON.parse(raw); } catch { req.body = raw; }
    } else {
      req.body = raw || undefined;
    }
    try {
      const mod = await import(pathToFileURL(file).href);
      await mod.default(req, res);
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.end('{"error":"Function crashed (see terminal)"}');
    }
    return;
  }

  // Anything else → static file (folders serve their index.html)
  let p = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}  (root: ${ROOT})`));
