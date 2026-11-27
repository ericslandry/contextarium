
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { Workspace } from '../runtime/workspace.mjs';
import { Coordinator } from '../runtime/coordinator.mjs';
import { observeForeground } from '../runtime/foreground.mjs';
import { startWorkspaceServer } from '../runtime/server.mjs';

const card = (id, props = {}) => ({ id, title: id, x: 0, y: 0, width: 200, height: 120, html: '<h1>' + id + '</h1>', ...props });
const document = (...compositions) => ({ format: 'contextarium-workspace', version: 1, compositions });
const delta = (upsert = [], remove = [], focusId = null) => ({ upsert, remove, focusId });

test('authority commits coherent candidates and rejects stale and invalid results', () => {
  const workspace = new Workspace('a', document(card('map')));
  const updates = [];
  workspace.subscribe(update => updates.push(update));
  const ticket = workspace.ticket();
  assert.throws(() => workspace.commit(ticket, delta([card('child', { parent: 'unknown' })])), /ancestry/);
  assert.throws(() => workspace.commit(ticket, delta([card('map', { parent: 'map' })])), /ancestry/);
  assert.equal(workspace.snapshot().revision, 0);
  assert.deepEqual(workspace.commit(ticket, delta([card('detail', { parent: 'map', js: 'root.title = "works";' })], [], 'detail'),
    { follow: true, rendererId: 'view-a', epoch: 2 }), { status: 'committed', revision: 1 });
  assert.deepEqual(updates[0].guidance, { id: 'detail', rendererId: 'view-a', epoch: 2 });
  assert.deepEqual(updates[0].upsert.map(record => record.id), ['detail']);
  assert.equal(workspace.commit(ticket, delta([], ['map'])).status, 'stale');
  assert.equal(new Workspace('b', document()).commit(workspace.ticket(), delta([card('leak')])).status, 'stale');
  const beforeImport = workspace.ticket();
  assert.equal(workspace.import(document(card('another')), beforeImport).status, 'committed');
  assert.equal(workspace.commit(beforeImport, delta([card('stale')])).status, 'stale');
  assert.deepEqual(workspace.export().compositions.map(item => item.id), ['another']);
  const beforeClose = workspace.ticket();
  workspace.close();
  assert.equal(workspace.commit(beforeClose, delta([card('late')])).status, 'stale');
});

test('observer correlates completed root turns and excludes interleaved worker and replay events', () => {
  const turns = [];
  const observer = observeForeground('session', turn => turns.push(turn));
  const send = (id, type, data, extra) => observer.handle({ id, sessionId: 'session', type, data, ...extra });
  send('replay', 'user.message', { interactionId: 'old', content: 'history' }, { checkpoint: true });
  send('u', 'user.message', { messageId: 'user-id', content: 'human turn' });
  send('w', 'user.message', { messageId: 'worker-id', content: 'worker turn', parentAgentTaskId: 'task' });
  send('start', 'assistant.turn_start', { turnId: 'root', interactionId: 'root-interaction', agentMode: 'interactive' });
  send('wstart', 'assistant.turn_start', { turnId: 'worker', parentToolCallId: 'task' });
  send('wm', 'assistant.message', { messageId: 'wm', originatingMessageId: 'worker-id', content: 'not context' }, { agentId: 'worker' });
  send('other', 'assistant.message', { messageId: 'other', originatingMessageId: 'user-id', content: 'not this session' }, { sessionId: 'other' });
  send('reply', 'assistant.message', { messageId: 'reply', originatingMessageId: 'user-id', content: 'visible root reply' });
  send('reply', 'assistant.message', { messageId: 'reply', originatingMessageId: 'user-id', content: 'duplicate' });
  send('endw', 'assistant.turn_end', { turnId: 'worker', parentToolCallId: 'task' });
  assert.deepEqual(turns, []);
  send('end', 'assistant.turn_end', { turnId: 'root' });
  send('end', 'assistant.turn_end', { turnId: 'root' });
  assert.deepEqual(turns, [{ user: 'human turn', assistant: 'visible root reply' }]);
  observer.close();
});

test('observer delivers one final reply for the native multi-turn tool sequence', () => {
  const delivered = [];
  const observer = observeForeground('desktop', turn => delivered.push(turn));
  let id = 0;
  const interactionId = 'one-user-interaction';
  const user = { interactionId, messageId: 'root-user', content: 'Illustrate a buffer', parentAgentTaskId: 'root-task' };
  const send = (type, data, extra) => observer.handle({ id: String(++id), type, data, ...extra });
  const start = turnId => send('assistant.turn_start', { interactionId, agentMode: 'interactive', turnId });
  const reply = (turnId, fields) => send('assistant.message', {
    interactionId, turnId, originatingMessageId: user.messageId, messageId: 'root-' + turnId, ...fields,
  });
  send('user.message', user);
  for (const turnId of ['0', '1']) {
    start(turnId);
    reply(turnId, { content: 'An interim tool step', toolRequests: [{ name: 'invoke_canvas_action' }] });
    send('assistant.turn_end', { turnId });
  }
  start('2');
  send('user.message', { interactionId, messageId: 'worker-user', content: 'Private work', source: 'agent-worker', parentAgentTaskId: 'worker-task' }, { agentId: 'worker' });
  send('assistant.turn_start', { interactionId, turnId: '0', agentMode: 'interactive', parentToolCallId: 'worker-task' }, { agentId: 'worker' });
  assert.deepEqual(delivered, []);
  reply('2', { content: 'The buffer has capacity five.', phase: 'final_answer', toolRequests: [] });
  send('assistant.turn_end', { turnId: '2' });
  send('assistant.message', { interactionId, turnId: '0', originatingMessageId: 'worker-user', messageId: 'child-result', content: 'Worker output' }, { agentId: 'worker' });
  send('assistant.turn_end', { turnId: '0', parentToolCallId: 'worker-task' }, { agentId: 'worker' });
  send('user.message', user);
  start('2');
  reply('2', { content: 'A differently journaled replay', phase: 'final_answer' });
  send('assistant.turn_end', { turnId: '2' });
  assert.deepEqual(delivered, [{ user: user.content, assistant: 'The buffer has capacity five.' }]);
  observer.close();
});

test('coalescing publishes the current intent while foreground remains responsive', async () => {
  const workspace = new Workspace('a', document());
  const jobs = [];
  const completions = [];
  const coordinator = new Coordinator({
    workspace, delay: 5, presentation: () => ({ follow: false }),
    compose: (input, signal) => new Promise(resolve => {
      jobs.push({ input, signal });
      completions.push(resolve);
    }),
  });
  const until = async predicate => {
    for (let tries = 0; tries < 70; tries++) {
      if (predicate()) return;
      await wait(5);
    }
    throw new Error('Timed out');
  };
  coordinator.configure(true);
  coordinator.observe({ user: 'first' });
  coordinator.observe({ user: 'second' });
  await until(() => jobs.length === 1);
  assert.deepEqual(jobs[0].input.conversation.map(turn => turn.user), ['first', 'second']);
  coordinator.observe({ user: 'third' });
  coordinator.request('explicit visualization');
  completions[0](delta([card('obsolete')]));
  await until(() => jobs.length === 2);
  assert.equal(jobs[1].input.request.intent, 'explicit visualization');
  completions[1](delta([card('current')], [], 'current'));
  await until(() => workspace.snapshot().revision === 1);
  assert.deepEqual(workspace.export().compositions.map(item => item.id), ['current']);
  coordinator.request('will be cancelled');
  await until(() => jobs.length === 3);
  coordinator.reset();
  assert.equal(jobs[2].signal.aborted, true);
  completions[2](delta([card('incorrect')]));
  await wait(5);
  assert.equal(workspace.snapshot().revision, 1);
  coordinator.close();
});

test('transport serves revisioned snapshots and exposes only renderer operations', async () => {
  const workspace = new Workspace('a', document(card('map')));
  const server = await startWorkspaceServer({
    workspace, status: () => 'Ready', onImport: () => {}, onPresentation: () => {},
  });
  const address = server.open('view');
  const url = new URL(address);
  try {
    assert.match(await (await fetch(address)).text(), /Spatial workspace/);
    function post(route, body, origin = url.origin) {
      return fetch(address + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    assert.equal((await post('import', {}, 'https://different.example')).status, 403);
    assert.equal((await post('workflow', {})).status, 404);
    assert.equal((await post('demo', {})).status, 404);
    assert.equal((await post('import', { document: document(card('new')), base: { generation: 5, revision: 0 } })).status, 409);
    assert.equal((await post('import', { document: document(card('new')), base: workspace.ticket() })).status, 200);
    const stream = await fetch(address + 'events');
    const reader = stream.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.match(first, /"type":"snapshot".*"generation":1.*"id":"new"/);
    await reader.cancel();
    assert.equal((await (await fetch(address + 'export')).json()).compositions[0].id, 'new');
    server.closeView('view');
    assert.equal((await fetch(address)).status, 404);
    const reopened = server.open('second');
    assert.equal((await (await fetch(reopened + 'export')).json()).compositions[0].id, 'new');
  } finally {
    server.close();
  }
});
