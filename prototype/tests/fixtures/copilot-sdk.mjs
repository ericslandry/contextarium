
import { setTimeout as delay } from 'node:timers/promises';

export const fixture = { jobs: [], subscribers: new Set(), runs: new Map(), plans: new Map() };
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
        const plan = fixture.plans.get(options.args.request.intent) ?? {};
        const job = { runId, controller, args: options.args, options, plan, cancelCount: 0 };
        fixture.jobs.push(job);
        job.run = workflow.run({
          args: options.args, phase() {},
          async agent(prompt, options) {
            Object.assign(job, { prompt, agent: options });
            await delay(plan.delayMs ?? 60, undefined, { signal: plan.ignoreCancellation ? undefined : controller.signal });
            return {
              remove: [], focusId: null, upsert: [{
                id: 'result-' + runId, title: 'Integrated candidate', x: 900, y: 600, width: 320, height: 200,
                scale: 1, opacity: 1, parent: null, html: '<p>Candidate from the workflow</p>',
                css: '', js: '',
              }],
            };
          },
        }).then(result => ({ runId, attempt: 1, status: 'completed', result, ...plan.outcome }),
          () => ({ runId, attempt: 1, status: 'cancelled', reason: 'Cancelled in Copilot' }));
        fixture.runs.set(runId, job);
        return { runId, attempt: 1, status: 'running' };
      },
      async waitForRun(runId, { signal } = {}) {
        const { run, plan } = fixture.runs.get(runId);
        if (plan.waitError) throw plan.waitError;
        if (!signal || plan.ignoreCancellation) return run;
        signal.throwIfAborted();
        let abort;
        try {
          const aborted = new Promise((_, reject) => {
            abort = () => reject(signal.reason);
            signal.addEventListener('abort', abort, { once: true });
          });
          return await Promise.race([run, aborted]);
        } finally {
          signal.removeEventListener('abort', abort);
        }
      },
      async cancel(runId) {
        const job = fixture.runs.get(runId);
        job.cancelCount++;
        job.controller.abort();
        return job.run;
      },
      async getRunDetail(runId) {
        const { run, plan } = fixture.runs.get(runId);
        if (plan.detail) return plan.detail;
        const { status } = await run;
        return { status, agents: [{ activeMs: 60, consumedNanoAiu: 0 }] };
      },
    },
  };
}

export function event(type, data, extra = {}) {
  fixture.sequence = (fixture.sequence ?? 0) + 1;
  for (const listener of fixture.subscribers) listener({ type, data, id: String(fixture.sequence), ...extra });
}
