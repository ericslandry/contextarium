
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { event, fixture } from './fixtures/copilot-sdk.mjs';

test('native adapter publishes workflow results, reports failures, and recovers without retrying', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@github/copilot-sdk/extension') {
        return { url: new URL('./fixtures/copilot-sdk.mjs', import.meta.url).href, shortCircuit: true };
      }
      return next(specifier, context);
    },
  });
  try { await import('../../plugins/contextarium/extensions/contextarium/extension.mjs'); }
  finally { hooks.deregister(); }

  const { canvas } = fixture;
  assert.equal(canvas.id, 'contextarium-experiment');
  assert.equal(canvas.displayName, 'Contextarium');
  const sessionId = 'native-sdk-fixture';
  const instanceId = 'native-canvas-instance';
  const invoke = (name, input) => canvas.actions.find(action => action.name === name).handler({
    sessionId, instanceId, extensionId: 'contextarium', canvasId: canvas.id, actionName: name, input,
  });
  const inspect = () => invoke('inspect_workspace', {});
  const eventually = async check => {
    for (let tries = 0; tries < 100; tries++) {
      const result = await check();
      if (result) return result;
      await delay(15);
    }
    throw new Error('Expected integration event did not arrive');
  };
  await assert.rejects(() => canvas.open({ sessionId: 'wrong', instanceId }), /inactive/);
  const { url, title } = await canvas.open({ sessionId, instanceId });
  assert.equal(title, 'Contextarium');
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
    const initial = await invoke('inspect_workspace', {});
    assert.equal(initial.workspace.revision, 0);
    assert.deepEqual(initial.workspace.compositions, []);
    assert.equal(initial.status, 'Automatic composition paused');
    const snapshot = await eventually(() => events.find(message => message.type === 'snapshot'));
    assert.deepEqual(snapshot.snapshot.compositions, []);
    await assert.rejects(() => invoke('request_visualization', {}), /Provide a visualization intent/);
    assert.deepEqual(await invoke('set_automatic_composition', { enabled: true }), { automatic: true });
    event('user.message', { interactionId: 'human', messageId: 'user', content: 'Focus on the estuary' });
    event('assistant.turn_start', { interactionId: 'human', turnId: 'turn', agentMode: 'interactive' });
    event('assistant.message', { interactionId: 'human', messageId: 'worker-message', content: 'Hidden worker output' }, { agentId: 'child' });
    event('assistant.message', { interactionId: 'human', messageId: 'root-message', content: 'Use a new composition', originatingMessageId: 'user' });
    event('assistant.turn_end', { turnId: 'turn' });
    const update = await eventually(() => events.find(message => message.type === 'delta'));
    assert.equal(update.revision, 1);
    assert.equal(update.upsert[0].id, 'result-1');
    assert.deepEqual(fixture.jobs[0].args.conversation, [{ user: 'Focus on the estuary', assistant: 'Use a new composition' }]);
    assert.match(fixture.jobs[0].prompt, /^# Author a Contextarium workspace/);
    assert.doesNotMatch(fixture.jobs[0].prompt, /# Report Contextarium feedback/);
    assert.deepEqual(events.filter(message => message.type === 'status' && message.kind === 'busy').map(message => message.text),
      ['Composition queued', 'Composing']);
    assert.equal(fixture.jobs[0].options.notifyOnComplete, false);
    assert.equal(Object.hasOwn(fixture.jobs[0].agent, 'tools'), false);
    assert.equal(fixture.workflow.meta.limits.timeoutSeconds, 330);
    assert.equal(fixture.jobs[0].agent.timeoutSeconds, 300);
    assert.deepEqual(await invoke('set_automatic_composition', { enabled: false }), { automatic: false });
    assert.deepEqual(await invoke('request_visualization', { intent: 'Show the reading room' }), { status: 'queued' });
    const secondJob = await eventually(() => fixture.jobs[1]);
    assert.equal(secondJob.args.request.intent, 'Show the reading room');
    event('user.message', { interactionId: 'ack', messageId: 'ack-user', content: 'Show the reading room' });
    event('assistant.turn_start', { interactionId: 'ack', turnId: 'ack-turn', agentMode: 'interactive' });
    event('assistant.message', { interactionId: 'ack', messageId: 'ack-reply', content: 'Queued' });
    event('assistant.turn_end', { turnId: 'ack-turn' });
    const explicitUpdate = await eventually(() => events.find(message => message.type === 'delta' && message.revision === 2));
    assert.equal(explicitUpdate.upsert[0].id, 'result-2');
    assert.equal(fixture.jobs.length, 2);

    const beforeFailure = (await inspect()).workspace;
    const timeoutError = 'Workflow agent reached its execution deadline';
    const delayedDetail = Promise.withResolvers();
    fixture.plans.set('Deadline', { outcome: { status: 'error', error: timeoutError }, detail: delayedDetail.promise });
    await invoke('request_visualization', { intent: 'Deadline' });
    await eventually(() => events.some(message => message.type === 'status' && message.kind === 'error' && message.text === timeoutError));
    const failed = await inspect();
    assert.deepEqual(failed.workspace, beforeFailure);
    assert.equal(failed.status, timeoutError);
    assert.equal(failed.lastWorkflowFailure.runId, fixture.jobs[2].runId);
    assert.equal(failed.lastWorkflowFailure.status, 'error');
    assert.equal(failed.lastWorkflowFailure.error, timeoutError);
    assert.ok(failed.lastWorkflowFailure.elapsedMs >= 0);
    assert.equal(failed.lastUsage, null);
    await delay(100);
    assert.equal(fixture.jobs.length, 3);
    assert.equal(fixture.jobs[2].cancelCount, 0);

    await invoke('request_visualization', { intent: 'Recover after the deadline' });
    const recovered = await eventually(() => events.find(message => message.type === 'delta' && message.revision === 3));
    assert.equal(recovered.upsert[0].id, 'result-4');
    assert.equal((await inspect()).lastWorkflow.status, 'completed');
    delayedDetail.resolve({
      status: 'error', approved: { timeoutSeconds: 330 }, consumed: { activeMs: 303_000, nanoAiu: 10_000 },
      agents: [{ model: { resolved: 'fixture-model' }, activeMs: 300_000, consumedNanoAiu: 10_000 }],
    });
    const diagnostics = await eventually(async () => {
      const value = await inspect();
      return value.lastWorkflowFailure.agents && value;
    });
    assert.equal(diagnostics.lastWorkflow.runId, fixture.jobs[3].runId);
    assert.equal(diagnostics.lastWorkflowFailure.activeMs, 303_000);
    assert.equal(diagnostics.lastWorkflowFailure.approvedTimeoutSeconds, 330);
    assert.equal(diagnostics.lastWorkflowFailure.consumedNanoAiu, 10_000);
    assert.deepEqual(diagnostics.lastWorkflowFailure.agents, [{ model: 'fixture-model', activeMs: 300_000, consumedNanoAiu: 10_000 }]);

    const waitError = 'Workflow status RPC disconnected';
    fixture.plans.set('Lost wait', { waitError: new Error(waitError) });
    await invoke('request_visualization', { intent: 'Lost wait' });
    await eventually(() => events.some(message => message.type === 'status' && message.kind === 'error' && message.text === waitError));
    assert.equal(fixture.jobs[4].cancelCount, 1);
    assert.equal((await inspect()).workspace.revision, 3);

    const budgetFailure = { type: 'workflow_limit_reached', kind: 'timeoutSeconds', value: 330, runId: '6' };
    fixture.plans.set('Workflow budget', { outcome: { status: 'error', failure: budgetFailure, reason: 'Workflow exceeded its active time limit' } });
    await invoke('request_visualization', { intent: 'Workflow budget' });
    await eventually(() => events.some(message => message.type === 'status' && message.text === 'Workflow exceeded its active time limit'));
    assert.deepEqual((await inspect()).lastWorkflowFailure.failure, budgetFailure);
    assert.equal((await inspect()).workspace.revision, 3);

    fixture.plans.set('Obsolete update', { delayMs: 200, ignoreCancellation: true });
    await invoke('request_visualization', { intent: 'Obsolete update' });
    const obsolete = await eventually(() => fixture.jobs[6]);
    await invoke('request_visualization', { intent: 'Replace the obsolete update' });
    const replacement = await eventually(() => events.find(message => message.type === 'delta' && message.revision === 4));
    assert.equal(obsolete.cancelCount, 1);
    assert.equal(replacement.upsert[0].id, 'result-8');
    assert.equal((await inspect()).workspace.compositions.some(item => item.id === 'result-7'), false);

    await invoke('request_visualization', { intent: 'Cancel this update on shutdown' });
    const shutdownJob = await eventually(() => fixture.jobs[8]);
    event('session.shutdown');
    await eventually(() => shutdownJob.controller.signal.aborted);
    assert.equal(shutdownJob.cancelCount, 1);
    assert.equal(fixture.subscribers.size, 0);
  } finally {
    event('session.shutdown');
    await reader.cancel().catch(() => {});
    await readEvents.catch(() => {});
  }
});
