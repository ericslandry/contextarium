
import { readFile } from 'node:fs/promises';
import { createCanvas, defineWorkflow, joinSession } from '@github/copilot-sdk/extension';
import { Coordinator } from '../../../../prototype/runtime/coordinator.mjs';
import { observeForeground } from '../../../../prototype/runtime/foreground.mjs';
import { startWorkspaceServer } from '../../../../prototype/runtime/server.mjs';
import { Workspace } from '../../../../prototype/runtime/workspace.mjs';

const load = path => readFile(new URL(path, import.meta.url), 'utf8');
const guide = (await load('../../../../prototype/skills/contextarium/SKILL.md'))
  .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();

const schema = {
  type: 'object',
  required: ['upsert', 'remove', 'focusId'],
  additionalProperties: false,
  properties: {
    upsert: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'x', 'y', 'width', 'height', 'scale', 'opacity', 'parent', 'html', 'css', 'js'],
        properties: {
          ...Object.fromEntries(['id', 'title', 'html', 'css', 'js'].map(key => [key, { type: 'string' }])),
          ...Object.fromEntries(['x', 'y', 'width', 'height', 'scale', 'opacity'].map(key => [key, { type: 'number' }])),
          parent: { type: ['string', 'null'] },
        },
      },
    },
    remove: { type: 'array', items: { type: 'string' } },
    focusId: { type: ['string', 'null'] },
  },
};

const workflow = defineWorkflow({
  meta: {
    name: 'contextarium-compose',
    description: 'Curate the Contextarium workspace in the background.',
    phases: [{ title: 'Compose the workspace' }],
    limits: { timeoutSeconds: 330, maxTotalSubagents: 1 },
  },
  async run(ctx) {
    ctx.phase('Compose the workspace');
    return ctx.agent(guide + '\n\nCurrent session input (JSON):\n' + JSON.stringify(ctx.args), {
      schema, timeoutSeconds: 300,
    });
  },
});

let session;
let workspace;
let coordinator;
let observer;
let unsubscribe;
let server;
let startingServer;
let presentation;
let activity = { text: 'Automatic composition paused', kind: 'idle' };
let lastWorkflow = null;
let lastWorkflowFailure = null;
let shutDown = false;
let activated = false;

function setStatus(text, kind = 'notice') {
  activity = { text, kind };
  server?.broadcastStatus(activity);
}

const errorMessage = error => error instanceof Error ? error.message : String(error);

function workflowError({ status, error, reason, failure }) {
  if (error || reason || failure?.reason) return error || reason || failure.reason;
  if (failure?.type === 'workflow_limit_reached') {
    return 'Workflow reached its ' + failure.kind + ' limit (' + failure.value + ')';
  }
  return 'Workflow ' + status + (failure?.type ? ' (' + failure.type + ')' : '');
}

async function collectRunDetail(diagnostic, cancellation) {
  if (cancellation) {
    const { result, error } = await cancellation;
    diagnostic.cancelError = error ?? null;
    diagnostic.hostStatus = result?.status ?? diagnostic.hostStatus;
    diagnostic.reason ??= result?.reason ?? null;
  }
  try {
    const detail = await session.workflow.getRunDetail(diagnostic.runId);
    diagnostic.hostStatus = detail.status ?? diagnostic.hostStatus;
    diagnostic.activeMs = detail.consumed?.activeMs ?? null;
    diagnostic.consumedNanoAiu = detail.consumed?.nanoAiu ?? null;
    diagnostic.approvedTimeoutSeconds = detail.approved?.timeoutSeconds ?? null;
    diagnostic.failure ??= detail.terminal?.failure ?? null;
    diagnostic.error ??= detail.terminal?.error ?? null;
    diagnostic.reason ??= detail.terminal?.reason ?? null;
    diagnostic.agents = detail.agents?.map(({ model, activeMs, consumedNanoAiu }) => ({
      model: model?.resolved ?? model?.requested ?? null, activeMs, consumedNanoAiu: consumedNanoAiu ?? null,
    })) ?? null;
  } catch (error) {
    diagnostic.detailError = errorMessage(error);
  }
}

async function compose(input, signal) {
  const compact = {
    ...input,
    workspace: {
      generation: input.workspace.generation,
      revision: input.workspace.revision,
      compositions: input.workspace.compositions.map(({ html, css, js, ...item }, index) => {
        const fields = { html, css, js };
        const include = item.id === input.presentation?.selection ? 10_000 : index < 5 ? 2_000 : 0;
        return { ...item, source: Object.fromEntries(Object.entries(fields).map(([key, value]) =>
          [key, { preview: value.slice(0, include), truncated: value.length > include }])) };
      }),
    },
  };
  const started = performance.now();
  let run;
  let result;
  let failureMessage;
  let cancellation;
  const cancel = () => {
    cancellation ??= session.workflow.cancel(run.runId)
      .then(result => ({ result }), error => ({ error: errorMessage(error) }));
  };
  try {
    run = await session.workflow.start(workflow, { args: compact, notifyOnComplete: false, logPhaseNames: false });
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    signal.throwIfAborted();
    result = await session.workflow.waitForRun(run.runId, { signal });
    signal.throwIfAborted();
    if (result.status !== 'completed') throw new Error(workflowError(result));
    return result.result;
  } catch (error) {
    if (run && !result) cancel();
    failureMessage = errorMessage(error);
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    const diagnostic = {
      runId: run?.runId ?? null,
      attempt: result?.attempt ?? run?.attempt ?? null,
      status: signal.aborted ? 'cancelled' : result?.status ?? 'error',
      hostStatus: result?.status ?? null,
      elapsedMs: Math.round(performance.now() - started),
      error: result?.error ?? (signal.aborted ? null : failureMessage ?? null),
      reason: result?.reason ?? (signal.aborted ? errorMessage(signal.reason) : null),
      failure: result?.failure ?? null,
      agents: null,
    };
    lastWorkflow = diagnostic;
    if (failureMessage && !signal.aborted) lastWorkflowFailure = diagnostic;
    // Diagnostic RPCs must never hold up publication or the next request.
    if (run) void collectRunDetail(diagnostic, cancellation);
  }
}

const emptyInput = { type: 'object', properties: {}, additionalProperties: false };
const displayName = 'Contextarium';
const canvas = createCanvas({
  id: 'contextarium-experiment',
  displayName,
  description: 'A living spatial workspace for this Copilot session.',
  actions: [
    {
      name: 'inspect_workspace',
      description: 'Read the current workspace, authoring guidance, presentation context and recent workflow diagnostics.',
      inputSchema: emptyInput,
      handler: async () => ({
        workspace: workspace.snapshot(), presentation: presentation ?? null, guide, status: activity.text,
        lastUsage: lastWorkflow?.agents ?? null, lastWorkflow, lastWorkflowFailure,
      }),
    },
    {
      name: 'request_visualization',
      description: 'Only on an explicit user visualization request, queue a Contextarium background composition.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['intent'],
        properties: { intent: { type: 'string' }, context: { type: 'string' } },
      },
      handler: async ({ input }) => {
        const { intent, context } = input ?? {};
        if (typeof intent !== 'string' || !intent.trim()) throw new Error('Provide a visualization intent');
        activated = true;
        coordinator.request(intent.trim().slice(0, 4_000), typeof context === 'string' ? context.slice(0, 7_000) : '');
        return { status: 'queued' };
      },
    },
    {
      name: 'set_automatic_composition',
      description: 'Enable or pause background composition only when the user explicitly requests the setting change. Enabling may consume Copilot model usage on completed conversation turns.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['enabled'], properties: { enabled: { type: 'boolean' } } },
      handler: async ({ input }) => {
        const { enabled } = input ?? {};
        if (typeof enabled !== 'boolean') throw new Error('Provide a boolean enabled value');
        if (enabled) activated = true;
        const automatic = coordinator.configure(enabled);
        return { automatic };
      },
    },
  ],
  open: async ({ sessionId, instanceId }) => {
    if (shutDown || sessionId !== session.sessionId) throw new Error('Canvas session is inactive');
    startingServer ??= startWorkspaceServer({
      workspace, activity: () => activity,
      onImport: () => { coordinator.reset(); setStatus('Workspace imported'); },
      onPresentation: value => { presentation = value; },
    }).catch(error => { startingServer = undefined; throw error; });
    server = await startingServer;
    if (shutDown) {
      server.close();
      throw new Error('Canvas session closed');
    }
    activated = true;
    return { url: server.open(instanceId), title: displayName };
  },
  onClose: async ({ instanceId }) => { server?.closeView(instanceId); },
});

function closeSession() {
  shutDown = true;
  unsubscribe?.();
  observer?.close();
  coordinator?.close();
  server?.close();
  workspace?.close();
}

session = await joinSession({ canvases: { definitions: [canvas] }, workflows: [workflow] });
workspace = new Workspace(session.sessionId);
coordinator = new Coordinator({ workspace, compose, presentation: () => presentation, onStatus: setStatus });
observer = observeForeground(session.sessionId, turn => coordinator.observe(turn));
unsubscribe = session.on(event => {
  if (event.type === 'session.shutdown') closeSession();
  else if (activated) observer.handle(event);
});
process.once('exit', closeSession);
