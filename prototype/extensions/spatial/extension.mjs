
import { readFile } from 'node:fs/promises';
import { createCanvas, defineWorkflow, joinSession } from '@github/copilot-sdk/extension';
import { Coordinator } from '../../runtime/coordinator.mjs';
import { observeForeground } from '../../runtime/foreground.mjs';
import { startWorkspaceServer } from '../../runtime/server.mjs';
import { Workspace } from '../../runtime/workspace.mjs';

const load = path => readFile(new URL(path, import.meta.url), 'utf8');
const guide = (await load('../../skills/contextarium/SKILL.md')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
const opening = JSON.parse(await load('../../examples/relay.json'));

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
    limits: { timeoutSeconds: 95, maxTotalSubagents: 1 },
  },
  async run(ctx) {
    ctx.phase('Compose the workspace');
    return ctx.agent(guide + '\n\nCurrent session input (JSON):\n' + JSON.stringify(ctx.args), {
      schema, timeoutSeconds: 85,
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
let status = 'Ready';
let lastUsage = null;
let shutDown = false;
let activated = false;

function setStatus(value) {
  status = value;
  server?.broadcastStatus(value);
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
  const run = await session.workflow.start(workflow, { args: compact, notifyOnComplete: false, logPhaseNames: false });
  const cancel = () => { session.workflow.cancel(run.runId).catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (signal.aborted) cancel();
    const result = await session.workflow.waitForRun(run.runId, { signal });
    if (result.status !== 'completed') throw new Error('Workflow ' + result.status);
    const detail = await session.workflow.getRunDetail(run.runId).catch(() => null);
    lastUsage = detail?.agents?.map(({ model, activeMs, consumedNanoAiu }) =>
      ({ model: model?.resolved ?? null, activeMs, consumedNanoAiu: consumedNanoAiu ?? null })) ?? null;
    return result.result;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

const emptyInput = { type: 'object', properties: {}, additionalProperties: false };
const canvas = createCanvas({
  id: 'contextarium-redesign',
  displayName: 'Contextarium Redesign',
  description: 'A living spatial workspace for this Copilot session.',
  actions: [
    {
      name: 'inspect_workspace',
      description: 'Read the current workspace, authoring guidance, presentation context and last background usage.',
      inputSchema: emptyInput,
      handler: async () => ({ workspace: workspace.snapshot(), presentation: presentation ?? null, guide, status, lastUsage }),
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
        setStatus(automatic ? 'Automatic composition on' : 'Automatic composition paused');
        return { automatic };
      },
    },
  ],
  open: async ({ sessionId, instanceId }) => {
    if (shutDown || sessionId !== session.sessionId) throw new Error('Canvas session is inactive');
    startingServer ??= startWorkspaceServer({
      workspace, status: () => status,
      onImport: () => { coordinator.reset(); setStatus('Workspace imported'); },
      onPresentation: value => { presentation = value; },
    }).catch(error => { startingServer = undefined; throw error; });
    server = await startingServer;
    if (shutDown) {
      server.close();
      throw new Error('Canvas session closed');
    }
    activated = true;
    return { url: server.open(instanceId), title: 'Contextarium Redesign' };
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
workspace = new Workspace(session.sessionId, opening);
coordinator = new Coordinator({ workspace, compose, presentation: () => presentation, onStatus: setStatus });
observer = observeForeground(session.sessionId, turn => coordinator.observe(turn));
unsubscribe = session.on(event => {
  if (event.type === 'session.shutdown') closeSession();
  else if (activated) observer.handle(event);
});
process.once('exit', closeSession);
