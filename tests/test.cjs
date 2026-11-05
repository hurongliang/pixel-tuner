const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
for (const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(html));
assert.ok(html.includes("connect-src 'none'"));
assert.ok(html.includes('$(k).oninput=requestUpdate'));
assert.equal((html.match(/class="stage"/g)||[]).length,1,'only one image preview');
assert.equal((html.match(/value="0" step="1"/g)||[]).length,3,'all defaults are zero');
assert.ok(html.includes('id="reset"'));
assert.ok(!html.includes('id="original"'));
const menu=html.match(/<select id="preset">([\s\S]*?)<\/select>/)[1];
const options=[...menu.matchAll(/<option\b[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g)].map(m=>[m[1],m[2]]);
assert.deepEqual(options,[['original','Original'],['taobao','Remove Taobao watermark'],['scan','Scan-style']],
  'each preset must be an independent, correctly formed option');
assert.ok(!/<option\b[^>]*\bdisabled\b/.test(menu),'all three options are selectable');
assert.ok(/<option\b[^>]*value="original"[^>]*\bselected\b/.test(menu),'original is selected by default');
assert.ok(!/<\/option\s+[^>]/.test(menu),'closing option tags cannot have attributes');
// Exercise the actual preset handlers independently of the async render queue.
const presetValues={brightness:0,contrast:0,sharpness:0};
let requests=0,writes=0;
const presetContext=vm.createContext({
  $:key=>({get value(){return presetValues[key]},set value(v){presetValues[key]=Number(v)}}),
  requestUpdate:()=>requests++,save:()=>writes++
});
vm.runInContext(`var keys=['brightness','contrast','sharpness'],busy=false,loaded=true,activePreset='original';
${html.match(/const presets=[^\n]+/)[0]}
${html.match(/const same=[^\n]+/)[0]}
${html.match(/function selectedPreset\(p\)[^\n]+/)[0]}
${html.match(/function applyPreset\(key\)[^\n]+/)[0]}`,presetContext);
assert.equal(presetContext.selectedPreset(presetValues),'original');
presetContext.applyPreset('taobao');
assert.deepEqual(presetValues,{brightness:-10,contrast:20,sharpness:20});
assert.equal(presetContext.selectedPreset(presetValues),'taobao');
presetContext.applyPreset('scan');
assert.deepEqual(presetValues,{brightness:0,contrast:100,sharpness:100});
assert.equal(presetContext.selectedPreset(presetValues),'scan');
presetValues.sharpness=99;
assert.equal(presetContext.selectedPreset(presetValues),'scan','manual adjustment keeps the starting preset');
assert.equal(presetContext.selectedPreset({brightness:0,contrast:0,sharpness:0}),'original','reset selects original');
presetContext.applyPreset('original');
assert.deepEqual(presetValues,{brightness:0,contrast:0,sharpness:0});
assert.equal(presetContext.selectedPreset(presetValues),'original');
assert.equal(requests,3);assert.equal(writes,3);
presetContext.busy=true;presetContext.applyPreset('taobao');assert.equal(requests,3);
presetContext.busy=false;presetContext.applyPreset('unknown');assert.equal(requests,3);
const scheduler = html.slice(html.indexOf('async function pumpPreview()'), html.indexOf("\n$('select').onclick"));
const cancel = html.match(/function cancelFull\(\)[^\n]+/)[0];
const jobs = [], timers = new Map(), shown = [], saved = [], originals = [];
let latest = {brightness: 0, contrast: 100, sharpness: 100}, nextTimer = 0;
const context = vm.createContext({
  Uint8ClampedArray, console,
  parameters: () => ({...latest}), message: () => {}, update: () => {},
  isNeutral: p => Object.values(p).every(v=>v===0),
  showOriginal: () => originals.push(true),
  $: key => ({get value(){return latest[key]},set value(v){latest[key]=Number(v)}}),
  setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
  clearTimeout: id => timers.delete(id),
  pixelsToBlob: async () => 'png-blob', showLive: blob => shown.push(blob),
  renderResult: () => {}, save: () => saved.push(context.result),
  startPixels: (data, width, height, parameters) => {
    let resolve, reject;
    const promise = new Promise((a,b) => {resolve=a;reject=b;});
    const job = {promise, resolve, width, height, parameters, cancelled:false,
      cancel() {this.cancelled=true;reject(Object.assign(new Error(), {name:'AbortError'}));}};
    // Preserve the cancel function's identity and avoid depending on its receiver.
    const handle = {promise, cancel: () => job.cancel()};
    jobs.push(job);return handle;
  }
});
vm.runInContext(`var original={file:{name:'sample.jpg'}},result=null,busy=false,loaded=true,keys=['brightness','contrast','sharpness'];
var sourceCanvas={width:2000,height:1000,toBlob:callback=>callback('neutral-png'),getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(4)})})};
var previewPixels=new Uint8ClampedArray(4),previewWidth=1280,previewHeight=640;
var revision=0,previewQueued=false,previewRunning=false,finalTimer=null,fullCancel=null,finalRevision=-1;
${cancel}\n${scheduler}\n${html.match(/function reset\(\)[^\n]+/)[0]}`, context);
const flush = () => new Promise(resolve => setImmediate(resolve));
const runTimer = () => {assert.equal(timers.size,1);const callback=timers.values().next().value;timers.clear();callback();};
(async () => {
  context.requestUpdate();
  for (let i=1;i<=25;i++) { latest.brightness=i;context.requestUpdate(); }
  assert.equal(jobs.length,1,'rapid inputs must not queue 25 workers');
  assert.equal(timers.size,1,'only the latest full-resolution timer remains');
  jobs[0].resolve(new Uint8ClampedArray(4));await flush();
  assert.equal(jobs.length,2);
  assert.equal(jobs[1].parameters.brightness,25,'next preview uses the latest value');
  jobs[1].resolve(new Uint8ClampedArray(4));await flush();
  runTimer();assert.equal(jobs[2].width,2000,'download is rendered at original size');
  latest.brightness=26;context.requestUpdate();await flush();
  assert.ok(jobs[2].cancelled,'new input cancels an obsolete full-resolution worker');
  assert.equal(saved.length,0,'obsolete full-resolution result is not saved');
  jobs[3].resolve(new Uint8ClampedArray(4));await flush();
  runTimer();jobs[4].resolve(new Uint8ClampedArray(4));await flush();
  assert.equal(saved.length,1);
  assert.equal(context.result.parameters.brightness,26);
  assert.equal(context.result.width,2000);
  assert.equal(context.finalRevision,context.revision);
  assert.ok(shown.length>0,'preview is published before full-resolution export');
  // A preview from a replaced source must never overwrite the new source.
  latest.brightness=27;context.requestUpdate();
  const count=shown.length;context.original={file:{name:'next.jpg'}};
  jobs[5].resolve(new Uint8ClampedArray(4));await flush();assert.equal(shown.length,count);
  latest.brightness=28;context.requestUpdate();runTimer();
  const workerCount=jobs.length,previewCount=shown.length;
  context.reset();await flush();
  assert.deepEqual(latest,{brightness:0,contrast:0,sharpness:0});
  assert.ok(jobs[7].cancelled,'reset cancels the active full-resolution worker');
  assert.ok(originals.length>0,'reset immediately displays original');
  jobs[6].resolve(new Uint8ClampedArray(4));await flush();
  assert.equal(shown.length,previewCount,'late preview must not replace original after reset');
  runTimer();await flush();
  assert.equal(jobs.length,workerCount,'neutral export skips image processing');
  assert.equal(context.result.blob,'neutral-png');
  assert.equal(context.finalRevision,context.revision);
  assert.deepEqual({...context.result.parameters},{brightness:0,contrast:0,sharpness:0});
  console.log('PASS: single preview, zero defaults, realtime scheduling, full-size export, reset cancellation, immediate original display, and stale result rejection.');
})().catch(error => {console.error(error);process.exitCode=1;});

require('./i18n.cjs');
