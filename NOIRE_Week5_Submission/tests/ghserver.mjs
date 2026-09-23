// Simulates GitHub Pages: files are served under /noire/, and unknown paths get 404.html with status 404
// (no rewrite to index.html). Usage: node ghserver.mjs <dir> <port>
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const [root, port] = [process.argv[2], Number(process.argv[3])];
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const prefix = '/noire/';
  let file = null;
  if (pathname.startsWith(prefix)) {
    let rel = pathname.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const candidate = join(root, rel);
    if (existsSync(candidate) && statSync(candidate).isFile()) file = candidate;
  }
  if (file) { res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(readFileSync(file)); }
  else { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(readFileSync(join(root, '404.html'))); }
}).listen(port, () => console.log('gh-pages simulator on', port));
