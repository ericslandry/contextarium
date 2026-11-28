
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { openDemo } from '../runtime/demo.mjs';

const defaultEdge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browserPath = process.env.CONTEXTARIUM_BROWSER || (process.platform === 'win32' ? defaultEdge : undefined);

async function eventually(check, description, timeout = 9_000) {
  for (const end = Date.now() + timeout; Date.now() < end;) {
    const result = await check();
    if (result) return result;
    await wait(40);
  }
  throw new Error('Timed out: ' + description);
}

test('browser renders both scenes, publishes without stealing the camera, and cleans up executable content',
  { timeout: 45_000, skip: browserPath ? false : 'Set CONTEXTARIUM_BROWSER to a Chromium or Edge binary' },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'contextarium-redesign-'));
    const demo = await openDemo();
    const browser = spawn(browserPath, ['--headless=new', '--disable-background-networking', '--no-first-run',
      '--no-proxy-server', '--remote-debugging-port=0', '--user-data-dir=' + dir, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const errors = [];
    browser.on('error', error => errors.push(error));
    let socket;
    try {
      const target = await eventually(async () => {
        if (errors.length) throw errors[0];
        try {
          const port = (await readFile(join(dir, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim();
          return (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(page => page.type === 'page');
        } catch { return false; }
      }, 'Chromium debug target');
      socket = new WebSocket(target.webSocketDebuggerUrl);
      await once(socket, 'open');
      const pending = new Map();
      let sequence = 0;
      socket.addEventListener('message', ({ data }) => {
        const event = JSON.parse(data);
        if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.text);
        const reply = pending.get(event.id);
        if (reply) {
          pending.delete(event.id);
          if (event.error) reply.reject(new Error(event.error.message));
          else reply.resolve(event.result);
        }
      });
      const rpc = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
      const evaluate = async expression => {
        const reply = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
        return reply.result.value;
      };
      const present = selector => evaluate('Boolean(document.querySelector(' + JSON.stringify(selector) + '))');
      const transform = () => evaluate("document.querySelector('#world').style.transform");
      const textLine = selector => evaluate(`(() => {
        const text = document.querySelector(${JSON.stringify(selector)}).firstChild;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, Math.min(14, text.length));
        const rect = range.getBoundingClientRect();
        return { x: rect.left + 1, y: (rect.top + rect.bottom) / 2, end: rect.right - 1 };
      })()`);
      const dragMouse = async ({ x, y, end }) => {
        await rpc('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x, y });
        await rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: (x + end) / 2, y });
        await rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: end, y });
        await rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, x: end, y });
      };
      const screenshot = async name => {
        if (!process.env.CONTEXTARIUM_SCREENSHOTS) return;
        const out = resolve(process.env.CONTEXTARIUM_SCREENSHOTS);
        await mkdir(out, { recursive: true });
        const png = await rpc('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(out, name + '.png'), Buffer.from(png.data, 'base64'));
      };
      const resize = (width, height) => rpc('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await rpc('Runtime.enable');
      await resize(1, 1);
      await rpc('Page.navigate', { url: demo.url });
      await eventually(() => present('[data-step]'), 'shared-document simulation');
      await resize(1280, 800);
      await eventually(() => evaluate("document.querySelector('#world').style.transform.includes('scale')"), 'first overview draw');
      await eventually(() => evaluate("document.querySelector('.relay-board').getBoundingClientRect().width > 400"), 'fit after initially hidden viewport');
      assert.equal(await evaluate("document.querySelectorAll('iframe').length"), 0);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.relay-board')).backgroundColor"), 'rgb(22, 52, 62)');
      assert.equal(await evaluate("document.querySelector('#surface-relay svg').ownerDocument === document"), true);
      assert.equal(await evaluate("document.querySelector('#viewport').getBoundingClientRect().bottom === innerHeight"), true);
      assert.equal(await present('[aria-label="Zoom in"], [aria-label="Zoom out"]'), false);
      await eventually(() => present('#activity[data-kind="idle"]'), 'quiet canvas while idle');
      await screenshot('relay-overview');
      const step = await evaluate(`(() => {
        const { x, y, width, height } = document.querySelector('[data-step]').getBoundingClientRect();
        return { x: x + width / 2, y: y + height / 2 };
      })()`);
      await rpc('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...step });
      await rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...step });
      assert.equal(await evaluate("document.querySelector('[data-queue]').value"), '1');
      const initialZoom = await evaluate("new DOMMatrix(getComputedStyle(document.querySelector('#world')).transform).a");
      await evaluate("document.querySelector('.relay-board').click(); document.querySelector('#breadcrumbs button:last-child').focus()");
      const wheel = await evaluate(`(() => {
        const { left, top } = document.querySelector('#viewport').getBoundingClientRect();
        return { x: left + 8, y: top + 8 };
      })()`);
      const deltaY = -180;
      await evaluate("document.querySelector('#demo-update').click()");
      await rpc('Input.dispatchMouseEvent', { type: 'mouseWheel', deltaX: 0, deltaY, ...wheel });
      await eventually(() => present('#activity[data-kind="busy"]'), 'background activity indicator');
      const wheelZoom = initialZoom * Math.exp(-deltaY * 0.0018);
      await eventually(() => evaluate("Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('#world')).transform).a - " + wheelZoom + ") < 0.0001"), 'wheel zoom applied');
      const manual = await evaluate("document.querySelector('#world').style.transform");
      await eventually(() => present('#surface-demo-update'), 'coalesced background publication');
      await eventually(() => evaluate("document.querySelector('#status').textContent === 'Workspace updated'"), 'publication feedback');
      assert.equal(await evaluate("document.activeElement === document.querySelector('#breadcrumbs button:last-child')"), true);
      assert.equal(await evaluate("document.querySelector('[data-queue]').value"), '1');
      assert.equal(await evaluate("document.querySelector('#world').style.transform"), manual);
      assert.equal(await evaluate("document.querySelector('#follow').getAttribute('aria-pressed')"), 'false');
      await evaluate("document.querySelector('#back').click()");
      await eventually(() => evaluate("document.querySelector('#world').style.transform !== " + JSON.stringify(manual)), 'view history');

      // Import trusted synthetic code and verify mount and teardown in the actual document.
      await evaluate("window.cleanupCount = 0");
      const importDocument = async (compositions, generation, revision) => evaluate(`fetch('import', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({
          base: {generation:${generation},revision:${revision}},
          document:{format:'contextarium-workspace',version:1,compositions:${JSON.stringify(compositions)}}
        })}).then(response=>response.status)`);
      const teardown = {
        id: 'teardown', title: 'Lifecycle', x: 0, y: 0, width: 340, height: 200,
        html: '<p data-marker>before</p>',
        css: 'p { color: yellow; }',
        js: "root.querySelector('p').textContent = 'mounted'; lifecycle.onCleanup(() => { window.cleanupCount++; });",
      };
      assert.equal(await importDocument([teardown], 0, 1), 200);
      await eventually(() => present('[data-marker]'), 'imported executable composition');
      assert.equal(await evaluate("document.querySelector('[data-marker]').textContent"), 'mounted');
      assert.equal(await evaluate("document.activeElement.id"), 'workspace-crumb');
      await evaluate("document.querySelector('#scene').value='reading'; document.querySelector('#scene').dispatchEvent(new Event('change'))");
      await eventually(() => present('#surface-essay'), 'editorial reading scene');
      assert.equal(await evaluate('window.cleanupCount'), 1);
      await screenshot('reading-overview');
      await resize(430, 660);
      await evaluate("document.querySelector('#jump').value='essay'; document.querySelector('#jump').dispatchEvent(new Event('change'))");
      await eventually(() => evaluate("document.querySelector('#breadcrumbs').textContent.includes('The right to revise')"), 'reading breadcrumb');
      await wait(750);
      assert.equal(await evaluate("document.querySelector('#surface-essay').getBoundingClientRect().width > 360"), true);
      assert.equal(await evaluate("parseFloat(getComputedStyle(document.querySelector('.columns p')).fontSize) * document.querySelector('.essay').getBoundingClientRect().width / document.querySelector('.essay').offsetWidth >= 13"), true);
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      assert.equal(await evaluate("document.querySelector('#select-text').offsetTop === document.querySelector('#jump').offsetTop"), true);
      await screenshot('reading-narrow-focus');
      const beforePan = await transform();
      await dragMouse(await textLine('.columns p'));
      await eventually(async () => await transform() !== beforePan, 'plain drag pans over composition text');
      assert.equal(await evaluate("getSelection().type === 'Range'"), false);
      assert.equal(await evaluate("document.activeElement.id"), 'viewport');
      await evaluate("document.querySelector('#select-text').click()");
      const beforeSelection = await transform();
      const line = await textLine('.columns p');
      assert.equal(await evaluate(`document.elementFromPoint(${line.x}, ${line.y}).matches('.columns p')`), true);
      await dragMouse(line);
      assert.equal(await evaluate("getSelection().toString().trim().length > 0"), true);
      assert.equal(await transform(), beforeSelection);
      await evaluate("document.querySelector('#select-text').click()");
      assert.equal(await evaluate("getSelection().type === 'Range'"), false);
      const metrics = await evaluate(`new Promise(resolve => {
        const intervals = [];
        let previous;
        let cycles = 0;
        function step(time) {
          if (previous !== undefined) intervals.push(time - previous);
          previous = time;
          document.querySelector('#viewport').dispatchEvent(new WheelEvent('wheel', {
            bubbles: true, cancelable: true, deltaY: cycles < 40 ? -64 : 64, clientX: innerWidth / 2, clientY: innerHeight / 2
          }));
          if (++cycles < 80) requestAnimationFrame(step);
          else resolve({ samples: intervals.length, p95: intervals.sort((a,b)=>a-b)[Math.ceil(intervals.length*.95)-1] });
        }
        requestAnimationFrame(step);
      })`);
      assert.equal(metrics.samples, 79);
      console.log('Narrow direct-rendering zoom sample:', metrics);
      assert.equal(await importDocument([], 2, 0), 200);
      await eventually(() => present('#empty:not([hidden])'), 'empty workspace guidance');
      await eventually(() => present('#activity[data-kind="idle"]'), 'import notice expires');
      await screenshot('empty-workspace');
      await evaluate("document.querySelector('#follow').click(); document.querySelector('#demo-update').click()");
      await eventually(() => evaluate(`(() => {
        const first = document.querySelector('#surface-demo-update')?.getBoundingClientRect();
        return first && Math.abs((first.left + first.right) / 2 - innerWidth / 2) < 1;
      })()`), 'first composition fits the untouched overview');
      assert.equal(await present('#empty[hidden]'), true);
      assert.equal(await importDocument([], 3, 1), 200);
      await eventually(() => present('#empty:not([hidden])'), 'reset to an empty workspace');
      const reset = await transform();
      await dragMouse({ x: 35, y: 500, end: 125 });
      const pannedEmpty = await eventually(async () => {
        const current = await transform();
        return current !== reset && current;
      }, 'manual pan in the empty workspace');
      await evaluate("document.querySelector('#demo-update').click()");
      await eventually(() => present('#surface-demo-update'), 'first publication after manual navigation');
      assert.equal(await transform(), pannedEmpty);
      assert.deepEqual(errors, []);
    } finally {
      socket?.close();
      demo.close();
      browser.kill();
      if (browser.exitCode === null) await Promise.race([once(browser, 'exit'), wait(2000)]);
      await rm(dir, { recursive: true, force: true, maxRetries: 6, retryDelay: 300 }).catch(() => {});
    }
  });
