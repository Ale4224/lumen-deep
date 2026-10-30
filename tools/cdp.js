// Minimal Chrome DevTools Protocol driver for headless testing (node >= 22, uses global WebSocket).
// usage: node tools/cdp.js <preset&tab> <out.png> [waitMs] [js-to-eval-before-shot]
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const [hash, out, waitMs = '2500', evalJs = '', size = '1400x860'] = process.argv.slice(2);
const [VW, VH] = size.split('x').map(Number);
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const root = path.resolve(__dirname, '..');
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'ldcdp-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', `--user-data-dir=${prof}`,
  `--remote-debugging-port=${port}`, '--window-size=1400,860', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let targets;
  for (let k = 0; k < 50; k++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch (e) {}
    await sleep(200);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: VW < 700 });
  const url = 'file:///' + root.replace(/\\/g, '/') + '/tools/demo.html#' + hash;
  await send('Page.navigate', { url });
  await sleep(+waitMs);
  const res = await send('Runtime.evaluate', { returnByValue: true, awaitPromise: true, expression: `(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); const w = document.querySelector('iframe').contentWindow; ${evalJs}; return { t: w.Scene.t, errs: w.__errs, fpsT: w.Scene.t }; })()` });
  console.log(JSON.stringify(res.result && res.result.result && res.result.result.value || res));
  if (out) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(root, 'tools', 'shots', out), Buffer.from(shot.result.data, 'base64'));
  }
  ws.close(); chrome.kill();
  process.exit(0);
})().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
