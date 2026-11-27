
const byId = id => document.getElementById(id);
const viewport = byId('viewport');
const world = byId('world');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const items = new Map();
const mounted = new Map();
const minZoom = 0.002;
const maxZoom = 64;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const endpoint = name => new URL(name, location.href);

let rendererId;
let generation = -1;
let revision = -1;
let selected = null;
let follow = true;
let epoch = 0;
let overviewMode = true;
let camera = { x: 0, y: 0, zoom: 1 };
let history = [];
let historyIndex = -1;
let animation = 0;
let pendingDraw = 0;
let pendingReport = 0;
let wheelHistory = 0;
let space = false;
let drag;
let pinch;
const touches = new Map();

const status = text => { byId('status').textContent = text; };
const stopAnimation = () => { cancelAnimationFrame(animation); animation = 0; };
function draw() {
  pendingDraw = 0;
  const { width, height } = viewport.getBoundingClientRect();
  world.style.transform = 'translate(' + (width / 2 - camera.x * camera.zoom) + 'px,' +
    (height / 2 - camera.y * camera.zoom) + 'px) scale(' + camera.zoom + ')';
  byId('scale').value = (camera.zoom >= 0.1 ? Math.round(camera.zoom * 100) :
    (camera.zoom * 100).toFixed(1)) + '%';
}

function redraw() {
  if (!pendingDraw) pendingDraw = requestAnimationFrame(draw);
}

async function post(name, body) {
  const response = await fetch(endpoint(name), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The workspace changed. Try again.');
  return result;
}

function report() {
  if (!rendererId || pendingReport) return;
  pendingReport = setTimeout(() => {
    pendingReport = 0;
    const { width, height } = viewport.getBoundingClientRect();
    post('presentation', { ...camera, width, height, selection: selected, epoch, follow }).catch(() => {});
  }, 70);
}

function takeControl() {
  stopAnimation();
  overviewMode = false;
  follow = false;
  epoch++;
  byId('follow').setAttribute('aria-pressed', 'false');
  report();
}

function record() {
  const previous = history[historyIndex];
  if (previous && previous.x === camera.x && previous.y === camera.y && previous.zoom === camera.zoom &&
      previous.selection === selected) return;
  history = [...history.slice(0, historyIndex + 1), { ...camera, selection: selected }].slice(-80);
  historyIndex = history.length - 1;
  updateHistory();
}

function updateHistory() {
  byId('back').disabled = historyIndex <= 0;
  byId('forward').disabled = historyIndex >= history.length - 1;
}

function fly(target, remember = true, duration = 660) {
  stopAnimation();
  const from = camera;
  const started = performance.now();
  if (motion.matches) duration = 0;
  const travel = frame => {
    const ratio = duration ? clamp((frame - started) / duration, 0, 1) : 1;
    const eased = ratio * ratio * (3 - 2 * ratio);
    const zoom = Math.exp(Math.log(from.zoom) * (1 - eased) + Math.log(target.zoom) * eased);
    camera = { x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased, zoom };
    redraw();
    if (ratio < 1) animation = requestAnimationFrame(travel);
    else {
      animation = 0;
      camera = { x: target.x, y: target.y, zoom: target.zoom };
      if (remember) record();
      report();
    }
  };
  animation = requestAnimationFrame(travel);
}

function fit(values) {
  values = values.filter(item => item.opacity > 0);
  if (!values.length) return { x: 0, y: 0, zoom: 1 };
  const left = Math.min(...values.map(item => item.x));
  const top = Math.min(...values.map(item => item.y));
  const right = Math.max(...values.map(item => item.x + item.width * item.scale));
  const bottom = Math.max(...values.map(item => item.y + item.height * item.scale));
  const margin = Math.min(100, viewport.clientWidth * 0.12);
  return {
    x: (left + right) / 2, y: (top + bottom) / 2,
    zoom: clamp(Math.min((viewport.clientWidth - margin) / (right - left),
      (viewport.clientHeight - margin) / (bottom - top)), minZoom, maxZoom),
  };
}

function select(id) {
  selected = id && items.get(id)?.opacity > 0 ? id : null;
  for (const [key, entry] of mounted) entry.node.setAttribute('aria-current', key === selected ? 'true' : 'false');
  const trail = byId('breadcrumbs');
  const base = document.createElement('button');
  base.textContent = 'Workspace';
  base.addEventListener('click', () => overview());
  const links = [base];
  for (let item = items.get(selected); item; item = items.get(item.parent)) {
    const current = item;
    const button = document.createElement('button');
    button.textContent = current.title;
    button.addEventListener('click', () => focus(current.id, true));
    links.splice(1, 0, '›', button);
  }
  trail.replaceChildren(...links);
  byId('jump').value = selected ?? '';
  report();
}

function updateJump() {
  const jump = byId('jump');
  const options = [new Option('Focus…', '')];
  for (const item of items.values()) if (item.opacity > 0) options.push(new Option(item.title, item.id));
  jump.replaceChildren(...options);
  jump.value = selected ?? '';
}

function overview(manual = true, animate = true) {
  if (manual) takeControl();
  overviewMode = true;
  select(null);
  if (viewport.clientWidth < 32 || viewport.clientHeight < 32) return;
  const target = fit([...items.values()]);
  if (animate) fly(target);
  else {
    camera = target;
    redraw();
    record();
    report();
  }
}

function focus(id, manual) {
  const item = items.get(id);
  if (!item || item.opacity === 0) return;
  if (manual) takeControl();
  overviewMode = false;
  select(id);
  fly(fit([item]));
}

function applyMount(item) {
  let entry = mounted.get(item.id);
  if (!entry) {
    const node = document.createElement('article');
    const root = document.createElement('div');
    node.className = 'composition';
    node.id = 'surface-' + item.id;
    root.className = 'composition-surface';
    node.append(root);
    world.append(node);
    entry = { node, root, source: null, dispose: () => {} };
    mounted.set(item.id, entry);
  }
  const { node, root } = entry;
  node.style.left = item.x + 'px';
  node.style.top = item.y + 'px';
  node.style.width = item.width + 'px';
  node.style.height = item.height + 'px';
  node.style.transform = 'scale(' + item.scale + ')';
  node.style.opacity = item.opacity;
  node.style.pointerEvents = item.opacity ? '' : 'none';
  node.inert = item.opacity === 0;
  node.setAttribute('aria-label', item.title);
  if (entry.source?.html === item.html && entry.source.css === item.css && entry.source.js === item.js) return;

  entry.dispose();
  entry.source = item;
  node.replaceChildren(root);
  root.innerHTML = item.html;
  const controller = new AbortController();
  const cleanup = [];
  if (item.css) {
    const style = document.createElement('style');
    style.textContent = '@scope (#' + node.id + ') {\n' + item.css + '\n}';
    node.prepend(style);
  }
  entry.dispose = () => {
    controller.abort();
    for (const callback of cleanup.reverse()) {
      try { callback(); } catch (error) { console.warn('Composition cleanup failed', error); }
    }
  };
  if (item.js) {
    try {
      const unmount = new Function('root', 'lifecycle', '"use strict";\n' + item.js)(root, {
        signal: controller.signal,
        onCleanup: callback => { if (typeof callback === 'function') cleanup.push(callback); },
      });
      if (typeof unmount === 'function') cleanup.push(unmount);
    } catch (error) {
      entry.dispose();
      entry.dispose = () => {};
      const notice = document.createElement('span');
      notice.className = 'composition-error';
      notice.textContent = 'Composition script stopped';
      node.append(notice);
      console.warn('Composition script stopped', error);
    }
  }
}

function remove(id) {
  const entry = mounted.get(id);
  if (entry) {
    entry.dispose();
    entry.node.remove();
    mounted.delete(id);
  }
  items.delete(id);
}

function reconcile(snapshot) {
  const changedGeneration = generation !== snapshot.generation;
  generation = snapshot.generation;
  revision = snapshot.revision;
  const incoming = new Set(snapshot.compositions.map(item => item.id));
  for (const id of items.keys()) if (!incoming.has(id)) remove(id);
  if (changedGeneration) {
    for (const id of [...items.keys()]) remove(id);
    history = [];
    historyIndex = -1;
  }
  for (const item of snapshot.compositions) {
    items.set(item.id, item);
    applyMount(item);
  }
  updateJump();
  select(changedGeneration ? null : selected);
  if (changedGeneration) overview(false, false);
  byId('empty').hidden = items.size > 0;
}

let stream;
function connect() {
  stream?.close();
  stream = new EventSource(endpoint('events'));
  stream.onmessage = event => {
    const update = JSON.parse(event.data);
    if (update.type === 'status') status(update.text);
    if (update.type === 'snapshot') {
      if (update.rendererId) rendererId = update.rendererId;
      if (update.demo != null) byId('demo').hidden = !update.demo;
      reconcile(update.snapshot);
      report();
    }
    if (update.type === 'delta') {
      if (update.generation === generation && update.revision <= revision) return;
      if (update.generation !== generation || update.baseRevision !== revision) return connect();
      for (const id of update.remove) remove(id);
      for (const item of update.upsert) {
        items.set(item.id, item);
        applyMount(item);
      }
      revision = update.revision;
      updateJump();
      select(selected);
      byId('empty').hidden = items.size > 0;
      if (follow && update.guidance?.rendererId === rendererId && update.guidance.epoch === epoch) {
        focus(update.guidance.id, false);
      }
    }
  };
  stream.onerror = () => status('Reconnecting');
}
connect();

function atZoom(zoom, clientX, clientY) {
  const box = viewport.getBoundingClientRect();
  const dx = clientX - box.left - box.width / 2;
  const dy = clientY - box.top - box.height / 2;
  const next = clamp(zoom, minZoom, maxZoom);
  camera = { x: camera.x + dx / camera.zoom - dx / next, y: camera.y + dy / camera.zoom - dy / next, zoom: next };
  redraw();
  report();
}

function zoomBy(factor) {
  const box = viewport.getBoundingClientRect();
  takeControl();
  atZoom(camera.zoom * factor, box.left + box.width / 2, box.top + box.height / 2);
  record();
}

function travelHistory(step) {
  if (!history[historyIndex + step]) return;
  takeControl();
  const target = history[historyIndex += step];
  select(target.selection);
  updateHistory();
  fly(target, false);
}

const scrollable = target => target.closest('input,select,textarea,[data-native-scroll]');
viewport.addEventListener('wheel', event => {
  if (!event.ctrlKey && scrollable(event.target)) return;
  event.preventDefault();
  takeControl();
  const distance = event.deltaY * [1, 16, viewport.clientHeight][event.deltaMode];
  atZoom(camera.zoom * Math.exp(clamp(-distance * 0.0018, -1, 1)), event.clientX, event.clientY);
  clearTimeout(wheelHistory);
  wheelHistory = setTimeout(record, 160);
}, { passive: false });

function beginDrag(event) {
  takeControl();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, viewX: camera.x, viewY: camera.y };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add('panning');
}

viewport.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') {
    if (event.target.closest('button,input,select,textarea,a,[data-native-scroll]')) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 1) beginDrag(event);
    if (touches.size === 2) {
      viewport.setPointerCapture(event.pointerId);
      drag = undefined;
      const [a, b] = [...touches.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    return;
  }
  if (event.button === 1 || (event.button === 0 && (space || !event.target.closest('.composition')))) {
    event.preventDefault();
    beginDrag(event);
  }
});

viewport.addEventListener('pointermove', event => {
  if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && touches.size === 2) {
    const [a, b] = [...touches.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    camera.x -= (x - pinch.x) / camera.zoom;
    camera.y -= (y - pinch.y) / camera.zoom;
    atZoom(camera.zoom * distance / Math.max(pinch.distance, 1), x, y);
    pinch = { distance, x, y };
  } else if (drag?.id === event.pointerId) {
    camera = { ...camera, x: drag.viewX - (event.clientX - drag.x) / camera.zoom,
      y: drag.viewY - (event.clientY - drag.y) / camera.zoom };
    redraw();
    report();
  }
});

function endGesture(event) {
  touches.delete(event.pointerId);
  if (drag?.id === event.pointerId || pinch) {
    drag = undefined;
    pinch = undefined;
    viewport.classList.remove('panning');
    record();
    report();
  }
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(type, endGesture);

viewport.addEventListener('click', event => {
  if (event.target.closest('button,input,select,textarea,a,[role="button"]') || getSelection()?.type === 'Range') return;
  const node = event.target.closest('.composition');
  if (node && node.id.slice(8) !== selected) {
    select(node.id.slice(8));
    record();
  }
});

viewport.addEventListener('dblclick', event => {
  if (event.target.closest('button,input,select,textarea,a,[role="button"]') || getSelection()?.type === 'Range') return;
  const node = event.target.closest('.composition');
  if (node) focus(node.id.slice(8), true);
});

const keyboardControl = event => event.target.closest('input, select, textarea, button, a, [contenteditable="true"]');
window.addEventListener('keydown', event => {
  if (keyboardControl(event)) return;
  if (event.code === 'Space') { space = true; event.preventDefault(); }
  if (event.target !== viewport) return;
  const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (movement) {
    takeControl();
    camera.x += movement[0] * 55 / camera.zoom;
    camera.y += movement[1] * 55 / camera.zoom;
    redraw();
    record();
    event.preventDefault();
  }
  if (event.key === '+' || event.key === '=') zoomBy(1.3);
  if (event.key === '-') zoomBy(1 / 1.3);
  if (event.key === 'Home') overview();
});
window.addEventListener('keyup', event => { if (event.code === 'Space') space = false; });
window.addEventListener('blur', () => { space = false; });
new ResizeObserver(() => {
  if (overviewMode && items.size && !animation && viewport.clientWidth >= 32 && viewport.clientHeight >= 32) {
    camera = fit([...items.values()]);
    if (historyIndex < 0) record();
    else if (history[historyIndex].selection === null) history[historyIndex] = { ...camera, selection: null };
  }
  redraw();
  report();
}).observe(viewport);
window.addEventListener('pagehide', () => {
  stream?.close();
  for (const entry of mounted.values()) entry.dispose();
});

byId('overview').onclick = () => overview();
byId('jump').onchange = event => {
  if (event.target.value) focus(event.target.value, true);
  else overview();
};
byId('back').onclick = () => travelHistory(-1);
byId('forward').onclick = () => travelHistory(1);
byId('zoom-out').onclick = () => zoomBy(1 / 1.38);
byId('zoom-in').onclick = () => zoomBy(1.38);
byId('follow').onclick = () => {
  follow = !follow;
  epoch++;
  if (!follow) stopAnimation();
  byId('follow').setAttribute('aria-pressed', String(follow));
  report();
};
byId('export').onclick = async () => {
  try {
    const response = await fetch(endpoint('export'));
    if (!response.ok) throw new Error('Export unavailable');
    const url = URL.createObjectURL(await response.blob());
    const download = document.createElement('a');
    download.href = url;
    download.download = 'contextarium-workspace.json';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { status(error.message); }
};
byId('import').onclick = () => byId('file').click();
byId('file').onchange = () => {
  const file = byId('file').files[0];
  byId('file').value = '';
  if (!file) return;
  const dialog = byId('trust');
  dialog.returnValue = 'cancel';
  dialog.addEventListener('close', async () => {
    if (dialog.returnValue !== 'open') return;
    try {
      if (file.size > 8_000_000) throw new Error('Workspace file is too large');
      const base = { generation, revision };
      await post('import', { document: JSON.parse(await file.text()), base });
      status('Workspace imported');
    } catch (error) { status(error.message); }
  }, { once: true });
  dialog.showModal();
};
byId('scene').onchange = () => post('demo', { action: byId('scene').value }).catch(error => status(error.message));
byId('demo-update').onclick = () => post('demo', { action: 'update' }).catch(error => status(error.message));
updateHistory();
