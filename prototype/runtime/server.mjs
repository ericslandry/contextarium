
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const files = {
  '': ['index.html', 'text/html; charset=utf-8'],
  'spatial.css': ['spatial.css', 'text/css; charset=utf-8'],
  'spatial.mjs': ['spatial.mjs', 'text/javascript; charset=utf-8'],
};

async function requestJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('Expected JSON');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8_000_000) throw new Error('Request is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function json(response, code, value) {
  response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function isPresentation(value) {
  return value && Number.isSafeInteger(value.epoch) && value.epoch >= 0 &&
    typeof value.follow === 'boolean' && [value.x, value.y, value.zoom, value.width, value.height].every(Number.isFinite) &&
    value.zoom > 0 && (value.selection == null || typeof value.selection === 'string');
}

// The renderer protocol only accepts workspace documents and presentation metadata.
export async function startWorkspaceServer({ workspace, status, onImport, onPresentation, demo }) {
  const views = new Map();
  let origin;
  const emit = (response, event) => {
    if (!response.destroyed && !response.writableEnded) response.write('data: ' + JSON.stringify(event) + '\n\n');
  };
  const unsubscribe = workspace.subscribe(event => {
    for (const view of views.values()) for (const response of view.streams) emit(response, event);
  });

  const server = createServer(async (request, response) => {
    try {
      if (request.headers.host !== new URL(origin).host) return json(response, 421, { error: 'Unknown host' });
      const url = new URL(request.url, origin);
      if (url.origin !== origin) return json(response, 421, { error: 'Unknown host' });
      const [, rendererId, route] = url.pathname.split('/');
      const view = views.get(rendererId);
      if (!view || url.pathname !== '/' + rendererId + '/' + (route ?? '')) {
        return json(response, 404, { error: 'Unknown workspace route' });
      }

      if (request.method === 'GET' && Object.hasOwn(files, route)) {
        const [file, type] = files[route];
        const data = await readFile(new URL('./' + file, import.meta.url));
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
        return response.end(data);
      }
      if (request.method === 'GET' && route === 'events') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store',
        });
        view.streams.add(response);
        response.on('close', () => view.streams.delete(response));
        emit(response, { type: 'snapshot', snapshot: workspace.snapshot(), rendererId, demo: Boolean(demo) });
        emit(response, { type: 'status', text: status() });
        return;
      }
      if (request.method === 'GET' && route === 'export') return json(response, 200, workspace.export());
      if (request.method !== 'POST') return json(response, 404, { error: 'Unknown workspace route' });
      if (request.headers.origin !== origin) return json(response, 403, { error: 'Wrong workspace origin' });
      if (route === 'presentation') {
        const value = await requestJson(request);
        if (!isPresentation(value)) return json(response, 400, { error: 'Invalid presentation state' });
        if (!view.presentation || value.epoch >= view.presentation.epoch) {
          const { x, y, zoom, width, height, selection, epoch, follow } = value;
          view.presentation = { x, y, zoom, width, height, selection: selection?.slice(0, 80) ?? null, epoch, follow, rendererId };
          onPresentation(view.presentation);
        }
        return json(response, 200, { ok: true });
      }
      if (route === 'import') {
        const body = await requestJson(request);
        const result = workspace.import(body.document, body.base);
        if (result.status === 'committed') onImport();
        return json(response, result.status === 'stale' ? 409 : 200, result);
      }
      if (route === 'demo' && demo) {
        const { action } = await requestJson(request);
        const result = await demo(action, view.presentation);
        return json(response, 200, result);
      }
      return json(response, 404, { error: 'Unknown workspace route' });
    } catch (error) {
      if (!response.headersSent) json(response, 400, { error: error.message });
      else response.end();
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = 'http://127.0.0.1:' + server.address().port;

  return {
    open(instanceId) {
      this.closeView(instanceId);
      const rendererId = randomUUID();
      views.set(rendererId, { instanceId, streams: new Set() });
      return origin + '/' + rendererId + '/';
    },
    closeView(instanceId) {
      for (const [id, view] of views) {
        if (view.instanceId !== instanceId) continue;
        views.delete(id);
        for (const response of view.streams) response.end();
      }
    },
    broadcastStatus(value) {
      for (const view of views.values()) {
        for (const response of view.streams) emit(response, { type: 'status', text: value });
      }
    },
    close() {
      unsubscribe();
      for (const view of views.values()) for (const response of view.streams) response.end();
      views.clear();
      server.close();
      server.closeAllConnections();
    },
  };
}
