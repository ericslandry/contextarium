
import { setTimeout as delay } from 'node:timers/promises';

export const fixture = { jobs: [], subscribers: new Set(), runs: new Map() };
export const createCanvas = attributes => attributes;
export const defineWorkflow = definition => definition;

export async function joinSession({ canvases, workflows }) {
  [fixture.canvas] = canvases.definitions;
  [fixture.workflow] = workflows;
  return {
    sessionId: 'native-sdk-fixture',
    on(listener) {
      fixture.subscribers.add(listener);
      return () => fixture.subscribers.delete(listener);
    },
    workflow: {
      async start(workflow, options) {
        const runId = String(fixture.runs.size + 1);
        const controller = new AbortController();
        const job = { controller, args: options.args, options };
        fixture.jobs.push(job);
        const run = workflow.run({
          args: options.args, phase() {},
          async agent(prompt, options) {
            Object.assign(job, { prompt, agent: options });
            await delay(60, undefined, { signal: controller.signal });
            return {
              remove: [], focusId: null, upsert: [{
                id: 'result-' + runId, title: 'Integrated candidate', x: 900, y: 600, width: 320, height: 200,
                scale: 1, opacity: 1, parent: null, html: '<p>Candidate from the workflow</p>',
                css: '', js: '',
              }],
            };
          },
        }).then(result => ({ status: 'completed', result }), () => ({ status: 'cancelled' }));
        fixture.runs.set(runId, { run, controller });
        return { runId, status: 'running' };
      },
      async waitForRun(runId) { return fixture.runs.get(runId).run; },
      async cancel(runId) { fixture.runs.get(runId).controller.abort(); },
      async getRunDetail() { return { agents: [{ activeMs: 60, consumedNanoAiu: 0 }] }; },
    },
  };
}

export function event(type, data, extra = {}) {
  fixture.sequence = (fixture.sequence ?? 0) + 1;
  for (const listener of fixture.subscribers) listener({ type, data, id: String(fixture.sequence), ...extra });
}
