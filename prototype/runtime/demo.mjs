
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Workspace } from './workspace.mjs';
import { Coordinator } from './coordinator.mjs';
import { observeForeground } from './foreground.mjs';
import { startWorkspaceServer } from './server.mjs';

async function fixture(name) {
  return JSON.parse(await readFile(new URL('../examples/' + name + '.json', import.meta.url), 'utf8'));
}

export async function openDemo() {
  const relay = await fixture('relay');
  const reading = await fixture('reading');
  const workspace = new Workspace('demo', relay);
  let status = 'Relay architecture';
  let presentation;
  let server;
  let sequence = 0;
  const setStatus = value => { status = value; server?.broadcastStatus(value); };
  const coordinator = new Coordinator({
    workspace, presentation: () => presentation, onStatus: setStatus, delay: 80,
    async compose(input, signal) {
      await delay(500, undefined, { signal });
      const scene = input.workspace.compositions;
      const parent = scene[0];
      const existing = scene.find(item => item.id === 'demo-update');
      const html = '<section class="finding"><h2>New observation</h2><p>' +
        (parent?.id === 'essay' ? 'Show where the evidence changed the argument.' :
          'When the arrival rate exceeds the publish rate, the backlog grows each tick.') + '</p></section>';
      return { upsert: [{
        id: 'demo-update', title: 'New observation', parent: parent?.id ?? null,
        x: parent ? parent.x + parent.width + 56 : 0, y: parent ? parent.y + 520 : 0,
        width: 448, height: 205, html,
        css: '.finding { background: #294335; color: #edf5d9; height: 100%; padding: 22px; border-radius: 14px; }' +
          'h2 { font: 34px Georgia; margin: 0 0 10px; } p { font-size: 19px; margin: 0; }',
        opacity: existing ? 0.8 : 1,
      }], remove: [], focusId: 'demo-update' };
    },
  });
  const observer = observeForeground('demo', turn => coordinator.observe(turn));
  coordinator.configure(true);
  server = await startWorkspaceServer({
    workspace,
    status: () => status,
    onPresentation: value => { presentation = value; },
    onImport: () => { coordinator.reset(); setStatus('Workspace imported'); },
    demo(action) {
      if (action === 'relay' || action === 'reading') {
        coordinator.reset();
        const result = workspace.import(action === 'relay' ? relay : reading, workspace.ticket());
        setStatus(action === 'relay' ? 'Relay architecture' : 'Reading room');
        return result;
      }
      if (action !== 'update') throw new Error('Unknown demo action');
      const interactionId = 'demo-' + ++sequence;
      const feed = (type, data) => observer.handle({ type, id: interactionId + '-' + type, data: { interactionId, ...data } });
      feed('user.message', { source: 'user', content: 'What changed in this explanation?' });
      feed('assistant.turn_start', { agentMode: 'interactive', turnId: interactionId });
      feed('assistant.message', { messageId: interactionId, content: 'The next observation belongs on the workspace.' });
      feed('assistant.turn_end', { turnId: interactionId });
      return { status: 'queued' };
    },
  });
  return {
    url: server.open('demo'),
    close() { observer.close(); coordinator.close(); server.close(); workspace.close(); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = await openDemo();
  console.log(demo.url);
  process.once('SIGINT', () => { demo.close(); });
}
