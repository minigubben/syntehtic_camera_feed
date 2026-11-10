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
