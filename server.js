import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRenderer } from './renderer.js';

export async function createCameraServer({ cameraName = process.env.CAMERA_NAME || 'Camera 1', timeZone = process.env.TZ || 'UTC', now = Date.now } = {}) {
  if (cameraName.length > 64 || /[\r\n]/.test(cameraName)) throw new Error('CAMERA_NAME must be a single line of at most 64 characters');
  const renderer = createRenderer({ cameraName, timeZone });
  const page = await readFile(new URL('./public/index.html', import.meta.url));
  let cachedSecond, cachedJpeg;
  return createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    try {
      let body, type;
      if (path === '/snapshot.jpg' || path === '/GetSnapshot/1') {
        const second = Math.floor(now() / 1000);
        if (second !== cachedSecond) {
          cachedJpeg = renderer.jpeg(second * 1000); cachedSecond = second;
        }
        body = cachedJpeg; type = 'image/jpeg';
      } else if (path === '/') { body = page; type = 'text/html; charset=utf-8'; }
      else if (path === '/healthz') { body = Buffer.from('ok\n'); type = 'text/plain'; }
      else { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      console.error('Snapshot request failed:', error);
      res.writeHead(500); res.end('Unable to render snapshot');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const server = await createCameraServer();
  server.listen(port, '0.0.0.0', () => console.log(`Camera preview: http://localhost:${port} | JPEG: /snapshot.jpg`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
