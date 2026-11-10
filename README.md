# Virtual Lava Camera

A Node.js fake security camera for testing snapshot consumers. It renders a fixed,
procedurally drawn room and table with an animated lava lamp, plus a camera name,
recording indicator and server timestamp burned into every 1280 × 720 JPEG.
No browser, external assets, GPU, or external services are required for rendering.

## Run with Docker Compose

```sh
docker compose up -d --build
```

- Preview page: http://localhost:3000/
- Camera snapshot: http://localhost:3000/snapshot.jpg
- Camera snapshot alias: http://localhost:3000/GetSnapshot/1
- Health check: http://localhost:3000/healthz

Configure your camera client to fetch the snapshot URL once per second. This is a
JPEG polling feed, not RTSP or multipart MJPEG. Other machines can use your Docker
host's address in place of localhost. The endpoint has no authentication.

Optional environment variables (shell or a `.env` file beside `compose.yaml`):

```dotenv
CAMERA_PORT=3000
CAMERA_NAME=Camera 1
TZ=UTC
```

`TZ` accepts an IANA timezone, such as `Europe/Stockholm`, and affects the OSD only.
Restart/recreate the service after configuration changes. `CAMERA_NAME` supports
up to 64 characters. For direct Node.js use, `PORT` sets the listening port.

## Run without Docker

Requires Node.js 22 or newer. The OSD font is bundled (Roboto Mono, SIL Open Font License; see `assets/OFL.txt`).

```sh
npm ci
npm start
```

## Timing and rendering

The scene is generated with Canvas. Background details use a fixed seed and remain
unchanged across requests and restarts. The wax uses a blended field of blobs whose
positions derive directly from Unix system time, with slow 105–219 second orbits.
There is no accumulated simulation state, random frame jitter, or animation reset
when a viewer connects. Clock corrections can move the animation because it follows
system time.

Frames are quantized to whole seconds and cached for that second, so all clients
receive the same image and multiple requests do not duplicate rendering work.
HTTP caching is disabled. The preview polls on second boundaries, retains the last
image during errors, and retries automatically. Pausing affects only the preview.

## Verify

```sh
npm test
```

Tests cover valid JPEG dimensions, deterministic rendering, gradual one-second
motion, stable background pixels, timestamp changes, and HTTP endpoint behavior.
