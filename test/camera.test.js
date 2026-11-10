import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadImage } from '@napi-rs/canvas';
import { createRenderer, lavaBlobs } from '../renderer.js';
import { createCameraServer } from '../server.js';
const time = Date.parse('2026-11-10T12:34:56Z');

test('JPEG is deterministic across renderer restarts and has the expected dimensions', async () => {
  const first = createRenderer().jpeg(time);
  assert.equal(first[0], 0xff); assert.equal(first[1], 0xd8);
  const image = await loadImage(first);
  assert.equal(image.width, 1280); assert.equal(image.height, 720);
  assert.deepEqual(first, createRenderer().jpeg(time));
  assert.notDeepEqual(first, createRenderer().jpeg(time + 1000));
});

test('wax moves gradually, including across orbit boundaries', () => {
  for(let second=0;second<500;second++){
    const a=lavaBlobs(time+second*1000),b=lavaBlobs(time+(second+1)*1000);
    a.forEach((blob,i)=>assert.ok(Math.hypot(blob.x-b[i].x,blob.y-b[i].y)<8));
  }
});

test('background stays fixed while lamp and OSD change', () => {
  const renderer=createRenderer();
  const region=(x,y,w,h)=>Buffer.from(renderer.draw(time).getContext('2d').getImageData(x,y,w,h).data);
  const background=region(100,100,300,400), lamp=region(690,200,140,270), osd=region(900,20,350,40);
  const next=renderer.draw(time+1000).getContext('2d');
  assert.deepEqual(background,Buffer.from(next.getImageData(100,100,300,400).data));
  assert.notDeepEqual(lamp,Buffer.from(next.getImageData(690,200,140,270).data));
  assert.notDeepEqual(osd,Buffer.from(next.getImageData(900,20,350,40).data));
});

test('HTTP serves fresh snapshots, preview, health, HEAD and errors', async (t) => {
  let current=time;
  const server=await createCameraServer({now:()=>current});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const first=await fetch(base+'/snapshot.jpg');
  assert.equal(first.headers.get('content-type'),'image/jpeg');
  assert.match(first.headers.get('cache-control'),/no-store/);
  const bytes=Buffer.from(await first.arrayBuffer());
  const alias=await fetch(base+'/GetSnapshot/1');
  assert.equal(alias.status,200);
  assert.equal(alias.headers.get('content-type'),'image/jpeg');
  assert.deepEqual(bytes,Buffer.from(await alias.arrayBuffer()));
  assert.deepEqual(bytes,Buffer.from(await (await fetch(base+'/snapshot.jpg?cache=123')).arrayBuffer()));
  current+=1000;
  assert.notDeepEqual(bytes,Buffer.from(await (await fetch(base+'/snapshot.jpg')).arrayBuffer()));
  assert.match(await (await fetch(base+'/')).text(),/snapshot.jpg/);
  assert.equal(await (await fetch(base+'/healthz')).text(),'ok\n');
  const head=await fetch(base+'/snapshot.jpg',{method:'HEAD'});
  assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await fetch(base+'/missing')).status,404);
  assert.equal((await fetch(base+'/snapshot.jpg',{method:'POST'})).status,405);
});

test('aquarium has deterministic frames, a fixed background and visibly moving fish', async () => {
  const { createAquariumRenderer, fishPositions } = await import('../aquarium.js');
  const renderer = createAquariumRenderer();
  const first = renderer.jpeg(time);
  const image = await loadImage(first);
  assert.equal(image.width,1280); assert.equal(image.height,720);
  assert.deepEqual(first,createAquariumRenderer().jpeg(time));
  const pixels = (x,y,w,h) => Buffer.from(renderer.draw(time).getContext('2d').getImageData(x,y,w,h).data);
  const cabinet = pixels(200,630,800,20), tank = pixels(150,170,980,350);
  const next = renderer.draw(time+1000).getContext('2d');
  assert.deepEqual(cabinet,Buffer.from(next.getImageData(200,630,800,20).data));
  assert.notDeepEqual(tank,Buffer.from(next.getImageData(150,170,980,350).data));
  for(let second=0;second<150;second++){
    const a=fishPositions(time+second*1000),b=fishPositions(time+(second+1)*1000);
    const distances=a.map((fish,i)=>Math.hypot(fish.x-b[i].x,fish.y-b[i].y));
    assert.ok(Math.max(...distances)>15,'visible motion each second');
    assert.ok(Math.max(...distances)<70,'no position jumps at path boundaries');
    assert.ok(b.every(fish=>fish.x>200&&fish.x<1080&&fish.y>180&&fish.y<520));
  }
});

test('second camera aliases share frames and remain independent of camera 1', async t => {
  let current=time;
  const server=await createCameraServer({now:()=>current});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(base+'/GetSnapshot/2');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'image/jpeg');
  assert.match(response.headers.get('cache-control'),/no-store/);
  const bytes=Buffer.from(await response.arrayBuffer());
  const get=async path=>Buffer.from(await(await fetch(base+path)).arrayBuffer());
  assert.deepEqual(bytes,await get('/aquarium.jpg?cache=1'));
  assert.notDeepEqual(bytes,await get('/GetSnapshot/1'));
  current+=1000;
  assert.notDeepEqual(bytes,await get('/aquarium.jpg'));
  assert.deepEqual(await get('/aquarium.jpg'),await get('/GetSnapshot/2'));
  const head=await fetch(base+'/GetSnapshot/2',{method:'HEAD'});
  assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await fetch(base+'/GetSnapshot/2',{method:'POST'})).status,405);
  const page=await(await fetch(base+'/')).text();
  assert.match(page,/data-camera="\/aquarium.jpg"/);
  assert.match(page,/data-camera="\/snapshot.jpg"/);
});
