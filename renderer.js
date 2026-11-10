import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

GlobalFonts.registerFromPath(fileURLToPath(new URL('./assets/RobotoMono.ttf', import.meta.url)), 'CameraMono');

export const WIDTH = 1280;
export const HEIGHT = 720;
const TAU = Math.PI * 2;

export function lavaBlobs(timeMs) {
  // Absolute Unix time, never process uptime or a frame counter. Each orbit is
  // continuous across its period boundary and repeats independently of requests.
  const seconds = timeMs / 1000;
  return Array.from({ length: 7 }, (_, i) => {
    const phase = (seconds % (105 + i * 19)) / (105 + i * 19) * TAU + i * 2.3;
    return {
      x: 75 + Math.sin(phase * 1 + i) * (17 + i * 2),
      y: 160 + Math.cos(phase) * (100 + (i % 3) * 12),
      r: 16 + (i % 3) * 5,
    };
  });
}

export function createRenderer({ cameraName = 'Camera 1', timeZone = 'UTC' } = {}) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const background = createCanvas(WIDTH, HEIGHT);
  const b = background.getContext('2d');
  const gradient = (ctx, x1, y1, x2, y2, stops) => {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    return g;
  };
  const ellipse = (ctx, x, y, rx, ry, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  };
  const polygon = (ctx, points, color) => {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  b.fillStyle = gradient(b, 0, 0, 0, HEIGHT, [[0, '#343d40'], [0.7, '#65645b'], [1, '#252a29']]);
  b.fillRect(0, 0, WIDTH, HEIGHT);
  // Fixed room details: wall panels, a framed print, shelf and books.
  for (let x = 35; x < WIDTH; x += 245) {
    b.fillStyle = '#00000017'; b.fillRect(x, 0, 3, 480);
    b.fillStyle = '#ffffff06'; b.fillRect(x + 3, 0, 2, 480);
  }
  b.fillStyle = '#202725'; b.fillRect(131, 105, 235, 238);
  b.fillStyle = '#aaa895'; b.fillRect(141, 115, 215, 218);
  b.fillStyle = '#555f59'; b.fillRect(164, 138, 169, 172);
  ellipse(b, 249, 200, 43, 43, '#999b83');
  polygon(b, [[164,310],[214,224],[258,270],[294,215],[333,284],[333,310]], '#344641');
  b.fillStyle = '#202b29'; b.fillRect(973, 284, 307, 12);
  ['#5a6158', '#6b554b', '#85816b', '#374b49', '#63594d'].forEach((c, i) => {
    b.fillStyle = c; b.fillRect(1020 + i * 26, 204 - i % 2 * 19, 23, 80 + i % 2 * 19);
    b.fillStyle = '#d2c5a730'; b.fillRect(1024 + i * 26, 218, 15, 3);
  });
  b.fillStyle = '#1d2624'; b.fillRect(0, 473, WIDTH, 10);
  polygon(b, [[96,493],[1053,463],[1280,610],[0,670]], gradient(b,0,460,0,680,[[0,'#625343'],[1,'#302a25']]));
  // Seeded wood grain; regenerated identically on every start.
  let seed = 1729;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  b.save(); b.beginPath(); b.moveTo(96,493); b.lineTo(1053,463); b.lineTo(1280,610); b.lineTo(0,670); b.closePath(); b.clip();
  for (let i = 0; i < 280; i++) {
    const y = 470 + random() * 210;
    b.strokeStyle = i % 2 ? '#b9a08012' : '#100e0c25'; b.lineWidth = random() * 1.4;
    b.beginPath(); b.moveTo(0,y); b.bezierCurveTo(400,y-20,850,y-33,1280,y-45); b.stroke();
  }
  b.restore();
  polygon(b, [[0,670],[1280,610],[1280,634],[0,696]], '#231f1b');
  polygon(b, [[132,688],[166,687],[158,720],[128,720]], '#191d1b');
  // Power cable and soft lamp shadow.
  b.strokeStyle = '#181b19'; b.lineWidth = 4; b.beginPath(); b.moveTo(803,558); b.bezierCurveTo(930,553,974,589,1122,552); b.stroke();
  for (let i = 30; i > 0; i--) ellipse(b, 783, 570, 60 + i * 2.9, 8 + i * 0.5, '#00000004');
  const glow = b.createRadialGradient(760,420,10,760,420,265);
  glow.addColorStop(0,'#f9923922'); glow.addColorStop(1,'#f9923900'); b.fillStyle=glow; b.fillRect(490,155,540,480);

  const frame = createCanvas(WIDTH, HEIGHT);
  const ctx = frame.getContext('2d');
  const wax = createCanvas(150, 340);
  const w = wax.getContext('2d');
  const glassPath = (c) => {
    c.beginPath(); c.moveTo(727,189); c.lineTo(793,189);
    c.bezierCurveTo(803,285,831,430,829,474);
    c.quadraticCurveTo(760,497,691,474); c.bezierCurveTo(689,430,717,285,727,189); c.closePath();
  };
  const metal = () => gradient(ctx,687,0,835,0,[[0,'#232c2d'],[0.23,'#697370'],[0.4,'#bcc0b3'],[0.55,'#747d77'],[0.8,'#3b4542'],[1,'#1b2526']]);

  function draw(timeMs) {
    ctx.drawImage(background, 0, 0);
    ctx.save(); glassPath(ctx); ctx.clip();
    ctx.fillStyle = gradient(ctx,690,0,830,0,[[0,'#273942'],[0.3,'#5c706a'],[0.6,'#62746b'],[1,'#263f44']]); ctx.fillRect(687,180,150,320);
    const blobs = lavaBlobs(timeMs);
    const pixels = w.createImageData(150,340);
    for (let y = 0; y < 340; y++) for (let x = 0; x < 150; x++) {
      let field = 210 / ((y - 320) ** 2 + 80) + 90 / ((y + 9) ** 2 + 100);
      for (const blob of blobs) field += blob.r ** 2 / ((x-blob.x)**2 + ((y-blob.y)*0.84)**2 + 1);
      const a = Math.max(0, Math.min(1, (field - 1.13) * 7));
      const p = (y*150+x)*4;
      pixels.data[p]=244; pixels.data[p+1]=95 + Math.round(y/340*55); pixels.data[p+2]=36;
      pixels.data[p+3]=Math.round(a*255);
    }
    w.putImageData(pixels,0,0); ctx.drawImage(wax,685,178,150,310);
    ctx.fillStyle=gradient(ctx,690,0,830,0,[[0,'#081c3580'],[0.26,'#ffffff15'],[0.5,'#ffffff00'],[0.87,'#071c3040'],[1,'#061221a0']]); ctx.fillRect(685,178,150,320);
    ctx.strokeStyle='#f4fff741'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(735,209); ctx.quadraticCurveTo(724,340,710,451); ctx.stroke();
    ctx.strokeStyle='#ffffff14'; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(744,215); ctx.lineTo(726,348); ctx.stroke();
    ctx.restore();
    glassPath(ctx); ctx.strokeStyle='#a8bdb044'; ctx.lineWidth=2; ctx.stroke();
    polygon(ctx,[[727,189],[737,153],[783,153],[793,189]],metal());
    ellipse(ctx,760,153,23,4,'#a4afa5'); ellipse(ctx,760,189,33,4,'#7b8980');
    polygon(ctx,[[691,476],[829,476],[802,523],[821,568],[699,568],[718,523]],metal());
    ellipse(ctx,760,476,69,9,metal());
    ellipse(ctx,760,477,60,5,'#d6a06850');
    ellipse(ctx,760,568,61,10,metal());
    ctx.strokeStyle='#0c151755';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(718,523);ctx.lineTo(802,523);ctx.stroke();
    // Fixed optical vignette and subtle scan lines, not random frame flicker.
    const vignette=ctx.createRadialGradient(640,350,230,640,350,770);
    vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#00000085');ctx.fillStyle=vignette;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle='#00000006';for(let y=0;y<HEIGHT;y+=3)ctx.fillRect(0,y,WIDTH,1);
    const parts=Object.fromEntries(formatter.formatToParts(new Date(timeMs)).map(p=>[p.type,p.value]));
    const stamp=`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    ctx.font='24px CameraMono';ctx.textBaseline='top';ctx.lineWidth=3;ctx.strokeStyle='#000000bb';ctx.fillStyle='#eeeeea';
    const text=(value,x,y)=>{ctx.strokeText(value,x,y);ctx.fillText(value,x,y);};
    text(cameraName,32,28);ctx.textAlign='right';text(stamp,1248,28);ctx.textAlign='left';
    ellipse(ctx,42,674,5,5,'#ce6155');text('REC',57,662);
    ctx.font='16px CameraMono';ctx.textAlign='right';text(timeZone,1248,668);ctx.textAlign='left';
    return frame;
  }
  return { draw, jpeg: (timeMs) => draw(timeMs).toBuffer('image/jpeg', 85) };
}
