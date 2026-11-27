
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { event, fixture } from './fixtures/copilot-sdk.mjs';

test('native adapter feeds attributed conversation to a workflow and publishes its result to the Canvas stream', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@github/copilot-sdk/extension') {
        return { url: new URL('./fixtures/copilot-sdk.mjs', import.meta.url).href, shortCircuit: true };
      }
      return next(specifier, context);
    },
  });
  try { await import('../extensions/spatial/extension.mjs'); }
  finally { hooks.deregister(); }

  const { canvas } = fixture;
  const invoke = (name, input) => canvas.actions.find(action => action.name === name).handler(input);
  const sessionId = 'native-sdk-fixture';
  const instanceId = 'native-canvas-instance';
  const eventually = async check => {
    for (let tries = 0; tries < 100; tries++) {
      const result = await check();
      if (result) return result;
      await delay(15);
    }
    throw new Error('Expected integration event did not arrive');
  };
  await assert.rejects(() => canvas.open({ sessionId: 'wrong', instanceId }), /inactive/);
  const { url } = await canvas.open({ sessionId, instanceId });
  const stream = await fetch(url + 'events');
  const reader = stream.body.pipeThrough(new TextDecoderStream()).getReader();
  const events = [];
  const readEvents = (async () => {
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop();
      for (const block of blocks) events.push(JSON.parse(block.slice(6)));
    }
  })();
  try {
    assert.equal((await invoke('inspect_workspace', {})).workspace.revision, 0);
    await invoke('set_automatic_composition', { enabled: true });
    event('user.message', { interactionId: 'human', messageId: 'user', content: 'Focus on the estuary' });
    event('assistant.turn_start', { interactionId: 'human', turnId: 'turn', agentMode: 'interactive' });
    event('assistant.message', { interactionId: 'human', messageId: 'worker-message', content: 'Hidden worker output' }, { agentId: 'child' });
    event('assistant.message', { interactionId: 'human', messageId: 'root-message', content: 'Use a new composition', originatingMessageId: 'user' });
    event('assistant.turn_end', { turnId: 'turn' });
    const update = await eventually(() => events.find(message => message.type === 'delta'));
    assert.equal(update.revision, 1);
    assert.equal(update.upsert[0].id, 'result-1');
    assert.deepEqual(fixture.jobs[0].args.conversation, [{ user: 'Focus on the estuary', assistant: 'Use a new composition' }]);
    assert.match(fixture.jobs[0].prompt, /Author a Contextarium workspace/);
    assert.equal(fixture.jobs[0].options.notifyOnComplete, false);
    assert.equal(Object.hasOwn(fixture.jobs[0].agent, 'tools'), false);
    assert.deepEqual(await invoke('request_visualization', { intent: 'Show the reading room' }), { status: 'queued' });
    const secondJob = await eventually(() => fixture.jobs[1]);
    assert.equal(secondJob.args.request.intent, 'Show the reading room');
    event('session.shutdown');
    await eventually(() => secondJob.controller.signal.aborted);
    assert.equal(fixture.subscribers.size, 0);
  } finally {
    event('session.shutdown');
    await reader.cancel().catch(() => {});
    await readEvents.catch(() => {});
  }
});
