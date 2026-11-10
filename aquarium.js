import { createCanvas } from '@napi-rs/canvas';
import { WIDTH, HEIGHT } from './renderer.js';

const TAU = Math.PI * 2;
const colors = ['#ecab57', '#6cd2df', '#eb775b', '#ddd59a', '#84c4d9', '#dd9860', '#b2c879'];

export function fishPositions(timeMs) {
  const seconds = timeMs / 1000;
  return colors.map((color, i) => {
    const period = 34 + i * 5;
    const phase = (seconds % period) / period * TAU + i * 1.7;
    return {
      x: 640 + Math.sin(phase) * (345 - i * 12),
      y: 235 + i * 36 + Math.sin(phase * 2 + i) * 32,
      // Turn continuously near the ends of the swimming path.
      facing: Math.tanh(Math.cos(phase) * 8),
      tail: Math.sin((seconds % 2.4) / 2.4 * TAU + i),
      size: 0.75 + (i % 3) * 0.2,
      color,
    };
  });
}

export function createAquariumRenderer({ cameraName = 'Camera 2', timeZone = 'UTC' } = {}) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const background = createCanvas(WIDTH, HEIGHT);
  const b = background.getContext('2d');
  const ellipse = (ctx, x, y, rx, ry, color) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  };
  const polygon = (ctx, points, color) => {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  const wall = b.createLinearGradient(0, 0, 0, HEIGHT);
  wall.addColorStop(0, '#283938'); wall.addColorStop(1, '#111d20');
  b.fillStyle = wall; b.fillRect(0, 0, WIDTH, HEIGHT);
  b.fillStyle = '#354440'; b.fillRect(85, 604, 1110, 24);
  b.fillStyle = '#222e2b'; b.fillRect(115, 628, 1050, 92);
  b.strokeStyle = '#111c1b'; b.lineWidth = 3;
  for (const x of [465, 815]) { b.beginPath(); b.moveTo(x, 635); b.lineTo(x, 720); b.stroke(); }
  b.fillStyle = '#708076'; for (const x of [420, 770, 1115]) b.fillRect(x, 656, 22, 4);
  b.fillStyle = '#0b171b'; b.fillRect(134, 112, 1012, 488);
  const water = b.createLinearGradient(0, 136, 0, 577);
  water.addColorStop(0, '#276277'); water.addColorStop(0.45, '#174556'); water.addColorStop(1, '#102e36');
  b.fillStyle = water; b.fillRect(150, 136, 980, 441);
  // Fixed light shafts, sand, rocks and plants; only fish move between frames.
  polygon(b, [[220,136],[280,136],[440,560],[250,560]], '#b7e5cd09');
  polygon(b, [[730,136],[780,136],[1020,560],[780,560]], '#b7e5cd09');
  polygon(b, [[150,550],[320,539],[575,558],[850,536],[1130,547],[1130,577],[150,577]], '#777a60');
  let seed = 9321;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 1800; i++) {
    const x = 150 + random() * 980, y = 553 + random() * 24;
    ellipse(b, x, y, 0.6 + random() * 2, 0.6 + random(), i % 2 ? '#c5bd8c50' : '#1d363b60');
  }
  for (const [x, y, rx, ry] of [[370,548,78,39],[436,552,49,25],[911,547,87,47],[975,553,52,28]]) {
    const rock = b.createLinearGradient(x, y - ry, x, y + ry);
    rock.addColorStop(0, '#657570'); rock.addColorStop(1, '#293e3c');
    ellipse(b, x, y, rx, ry, rock);
  }
  for (const root of [205, 270, 523, 1016, 1080]) {
    for (let j = 0; j < 8; j++) {
      const x = root + (random() - 0.5) * 48, height = 65 + random() * 210;
      const bend = (random() - 0.5) * 85;
      b.strokeStyle = ['#3e7960','#47866b','#265c52'][j % 3]; b.lineWidth = 4 + random() * 6;
      b.beginPath(); b.moveTo(x,560); b.bezierCurveTo(x-25,520,x+bend,560-height/2,x+bend,560-height); b.stroke();
      for (let k = 1; k < 5; k++) {
        const y = 560 - height * k / 5, leafX = x + bend * k / 5;
        ellipse(b, leafX + (k % 2 ? 9 : -9), y, 15, 5, j % 2 ? '#42785e' : '#306850');
      }
    }
  }
  b.fillStyle = '#15282e'; b.fillRect(1090, 153, 25, 210);
  b.fillStyle = '#3c5155'; for (let y=298;y<355;y+=8) b.fillRect(1094,y,17,3);
  b.strokeStyle = '#0e1c21'; b.lineWidth=6; b.beginPath(); b.moveTo(1103,153); b.lineTo(1103,120); b.lineTo(1150,120); b.stroke();

  const frame = createCanvas(WIDTH, HEIGHT), ctx = frame.getContext('2d');
  function draw(timeMs) {
    ctx.drawImage(background, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(150,136,980,441); ctx.clip();
    for (const fish of fishPositions(timeMs)) {
      ctx.save(); ctx.translate(fish.x, fish.y); ctx.scale(fish.size * fish.facing, fish.size);
      polygon(ctx, [[-23,0],[-53, -20 - fish.tail * 5],[-48,20 + fish.tail * 5]], fish.color);
      polygon(ctx, [[-12,-12],[2,-33],[23,-10]], fish.color);
      polygon(ctx, [[-5,12],[8,27],[24,9]], '#d0a86c');
      const body = ctx.createLinearGradient(0,-20,0,20);
      body.addColorStop(0,fish.color); body.addColorStop(1,'#577b76');
      ellipse(ctx,0,0,34,19,body);
      ctx.globalAlpha=0.35;
      for(const x of [-12,0,12]) { ctx.fillStyle='#193e47'; ctx.fillRect(x,-13,4,26); }
      ctx.globalAlpha=1;
      ellipse(ctx,23,-5,4.5,4.5,'#f1e4bc'); ellipse(ctx,24,-5,2.3,2.8,'#10252e');
      polygon(ctx, [[0,2],[-13,12],[12,10]], '#eed19b90');
      ctx.restore();
    }
    // Stationary glass reflections keep the scene calm around the swimming fish.
    polygon(ctx, [[175,145],[193,145],[250,567],[228,567]], '#e4ffff09');
    ctx.fillStyle='#c7f0e531';ctx.fillRect(150,143,980,3);
    ctx.restore();
    ctx.strokeStyle='#081a20';ctx.lineWidth=14;ctx.strokeRect(143,129,994,455);
    ctx.fillStyle='#5c7777';ctx.fillRect(137,116,1006,6);
    ctx.fillStyle='#75928b55';ctx.fillRect(144,591,993,3);
    const vignette=ctx.createRadialGradient(640,350,260,640,350,770);
    vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#00000080');ctx.fillStyle=vignette;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle='#00000006';for(let y=0;y<HEIGHT;y+=3)ctx.fillRect(0,y,WIDTH,1);
    const parts=Object.fromEntries(formatter.formatToParts(new Date(timeMs)).map(p=>[p.type,p.value]));
    const stamp=`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    ctx.font='24px CameraMono';ctx.textBaseline='top';ctx.lineWidth=3;ctx.strokeStyle='#000000bb';ctx.fillStyle='#eeeeea';
    const text=(value,x,y)=>{ctx.strokeText(value,x,y);ctx.fillText(value,x,y);};
    text(cameraName,32,28);ctx.textAlign='right';text(stamp,1248,28);ctx.textAlign='left';
    ellipse(ctx,42,674,5,5,'#ce6155');ctx.fillStyle='#eeeeea';text('REC',57,662);
    ctx.font='16px CameraMono';ctx.textAlign='right';text(timeZone,1248,668);ctx.textAlign='left';
    return frame;
  }
  return { draw, jpeg: timeMs => draw(timeMs).toBuffer('image/jpeg',85) };
}
