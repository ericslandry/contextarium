# Dynamic Workflow reliability in Contextarium 0.4.1

## Timeout investigation

The SDK bundled with GitHub Copilot Desktop 1.5.0 uses protocol 4. Its installed `workflow.d.ts` lists **2,147,483.647 seconds** as the agent timeout maximum. The installed `extension.js` accepted 330 seconds and the same maximum in a direct `defineWorkflow` check, then rejected 2,147,483.648 seconds. The local runtime binary contains the reported `Workflow agent reached its execution deadline` message and the `workflow_agent_timeout` identifier.

Copilot runs two clocks. The agent timeout covers queueing, preparation and execution for the individual agent call. The workflow timeout covers accumulated active time across the workflow, including the extension body, agent waits and sleeps. The installed SDK forwards the agent timeout to the runtime. Its `waitForRun` method watches for a terminal result and has no separate fixed deadline. Contextarium 0.4.1 requests **300 seconds for the agent** and **330 seconds for the workflow**, up from 85 and 95 seconds. Copilot also documents effective workflow limits from invocation and settings and can stop a run for resource limits or runtime failures. The inspection found no lower fixed deadline in the installed SDK. A live model run past the old deadline would be needed to establish whether the host or model service imposes another time limit. [GitHub Dynamic Workflows](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/dynamic-workflows#limiting-a-dynamic-workflow)

## Failure handling and diagnostics

- The canvas uses the host's error, termination reason or resource-limit detail in its existing activity indicator. A failed or cancelled attempt publishes no composition and does not retry the model call. Workspace revisions and generation checks still reject stale results, including a result that arrives after cancellation.
- `inspect_workspace` returns `lastWorkflow` and `lastWorkflowFailure`. Each includes the run ID, attempt, outcome, elapsed time observed by the extension, and error, reason or structured failure when available. Copilot's run detail can add active execution time, the approved workflow timeout, total and per-agent usage in nano-AIU, and the agent model. The `lastUsage` field still exposes per-agent usage for the most recent attempt when available.
- Run detail is collected asynchronously. A delayed or failed diagnostics request cannot block workspace publication or the next composition. The extension retains these summaries for the current session, and Copilot keeps its own workflow run details.

## Deterministic validation

Run `node --test prototype/tests/*.test.mjs`. The native SDK fixture checks the configured limits, exact deadline error, unchanged workspace, recovery without a retry, delayed run detail, RPC failure, cancellation, and rejection of a late result. The browser suite checks the published workspace and human camera precedence. The SDK registration probe and regression suite use no Copilot model calls.
