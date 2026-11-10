import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRenderer } from './renderer.js';
import { createAquariumRenderer } from './aquarium.js';

export async function createCameraServer({ cameraName = process.env.CAMERA_NAME || 'Camera 1', camera2Name = process.env.CAMERA_2_NAME || 'Camera 2', timeZone = process.env.TZ || 'UTC', now = Date.now } = {}) {
  if (cameraName.length > 64 || /[\r\n]/.test(cameraName)) throw new Error('CAMERA_NAME must be a single line of at most 64 characters');
  if (camera2Name.length > 64 || /[\r\n]/.test(camera2Name)) throw new Error('CAMERA_2_NAME must be a single line of at most 64 characters');
  const cameras = [
    { renderer: createRenderer({ cameraName, timeZone }) },
    { renderer: createAquariumRenderer({ cameraName: camera2Name, timeZone }) },
  ];
  const routes = new Map([['/snapshot.jpg', cameras[0]], ['/GetSnapshot/1', cameras[0]],
    ['/aquarium.jpg', cameras[1]], ['/GetSnapshot/2', cameras[1]]]);
  const page = await readFile(new URL('./public/index.html', import.meta.url));
  return createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    try {
      let body, type;
      const camera = routes.get(path);
      if (camera) {
        const second = Math.floor(now() / 1000);
        if (second !== camera.cachedSecond) {
          camera.cachedJpeg = camera.renderer.jpeg(second * 1000); camera.cachedSecond = second;
        }
        body = camera.cachedJpeg; type = 'image/jpeg';
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
