# Contextarium redesign validation

**Date** November 27, 2026  
**Scope** [Redesign feasibility gates](REDESIGN-FEASIBILITY.md#6-targeted-handoff-work-validation-protocol). Disposable local plugin, synthetic inputs, and deterministic workflow code.

## Decisions

- Keep Dynamic Workflows as the first candidate for background composition. The installed host ran and cancelled deterministic work and delivered its structured result to a visible Canvas. Adoption still depends on proving composition-only permissions, live model concurrency, and acceptable usage and host behavior.
- Keep opaque, script-free iframe compositions as the rendering prototype. The WebView rendered rich HTML and SVG. The measured zoom cadence calls for limiting live frames and profiling culling before setting release budgets. Complete structural content validation and the remaining isolation cases before admitting generated markup.
- Keep one session-owned workspace writer, with workspace revision, conversation freshness, and camera epoch checked independently. The deterministic probe passed these checks and demonstrated full snapshot recovery.

## Gate results

| Gate | Status | Evidence and limits |
| --- | --- | --- |
| 0. Environment and install | Pass for the zero-model probe | GitHub Copilot desktop **1.5.0**, local Node **24.22.3**, standalone Edge **158.0.4370.45**. The installed CLI package reports **@github/copilot 1.0.115-7** and the bundled SDK declaration specifies protocol **4**. The exact SDK package version and the WebView runtime selected by the host were not independently confirmed. The native local marketplace exposed the probe plugin, extension, and Canvas. |
| 1. Foreground observation | Partial | The native observer registered in separate session processes and recorded workflow and shutdown events. The deterministic observer test exercised session filtering, deduplication, redaction, worker filtering, and unsubscribe. Native user and assistant message ordering, turn completion, replay, and cross-session isolation of real conversation events remain unverified. |
| 2. Background runtime | Pass for deterministic execution. Live model gate open. | Three native completions took **1,522–1,541 ms**. Three cancellations took **99–127 ms** and returned no marker. Native activity showed the completed and cancelled runs. The test made **zero model calls**. Foreground model concurrency, inherited tool grants, authentication scope, usage, and workflow retention remain unverified. |
| 3. State and rendering | Pass for the tested paths | Four deterministic state/transport tests passed, covering obsolete jobs, session fencing, atomic rejection, duplicate and reordered snapshots, import and reset, camera takeover, disconnect, reconnect, and teardown. In a fresh native **No repository** session, the completed workflow published revision 1, the trusted WebView shell displayed it, and the renderer acknowledged it **157 ms** after publication. The cancelled run produced no result. Foreground progress was simulated in the standalone test. |
| 4. Isolation and spatial quality | Partial | Styled HTML and tables, SVG paths, gradients and masks, and CSS animation rendered in standalone Edge and native WebView. The fixtures used opaque, script-free frames and a restrictive CSP. The tested local request sink received zero requests. Performance and the remaining security and accessibility cases are detailed below. |
| 5. Skill and lifecycle | Partial | The disposable skill, extension and Canvas were discoverable in Installed. A fresh no-repository session loaded the local source changes, and a refreshed Installed view showed **0.0.3**. Per-plugin **Update** and **Uninstall** both returned “Plugin is not installed” while the UI listed it. **Remove and uninstall** on the disposable marketplace succeeded, and Installed returned no matching entries. Background model access to the skill remains unverified. |

## Native workflow and Canvas

The disposable extension imported `createCanvas`, `defineWorkflow`, and `joinSession` from `@github/copilot-sdk/extension`. The tested registration was `joinSession({canvases: {definitions: [canvas]}, workflows: [workflow]})`. The workflow used a deterministic `ctx.step` with `ctx.signal`. The extension invoked `session.workflow.start(workflow, options)`, `getRun(runId)`, `cancel(runId)`, and `waitForRun(runId, {signal})`. The result was read from the completed run.

The trusted shell polled a disposable, session-specific loopback route and displayed **Workflow result applied to Canvas: FEASIBILITY_PROBE (revision 1).** The extension logged publication, the browser acknowledgment and Canvas close. Cancellation and publication used separate runs. No conversation prompts, credentials or message content were sent. Polling was a probe expedient. The separate transport test proved snapshot delivery and reconnect, so this run does not select a shipping transport.

An installed local-path marketplace can reflect source edits in a fresh session even if the per-plugin updater fails. This run supplies evidence of live source refresh and marketplace-level cleanup. The prior private GitHub marketplace test in [the plugin guide](COPILOT-PLUGIN.md) is the evidence for a native remote version upgrade.

## Rendering measurements

Times are from one standalone rerun and the latest native run. Load is measured from shell startup to the iframe load check. Frame p95 describes a scripted zoom and translation stress loop, including zoom up to 100×. The heap estimate covers the shell JavaScript context. It does not measure whole-process or iframe memory.

| Host and delivery | Viewport | Compositions | Load | Frame p95 | Projected focused text | Frame elements after explicit removal |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Edge srcdoc | 440 × 650 | 5 | 302 ms | 66.4 ms | 16.0 px | 1 |
| Edge srcdoc | 520 × 980 | 5 | 100 ms | 50.0 ms | 19.1 px | 1 |
| Edge srcdoc | 1000 × 750 | 5 | 109 ms | 66.8 ms | 20.0 px | 1 |
| Edge srcdoc | 1000 × 750 | 20 | 247 ms | 83.3 ms | 20.0 px | 1 |
| Edge HTTP CSP | 520 × 980 | 5 | 59 ms | 50.0 ms | 19.1 px | 1 |
| Copilot WebView srcdoc | 420 × 832 | 5 | 262 ms | 100.0 ms | 15.2 px | 1 |

Edge reported approximately 1.1–2.0 MB of shell JS heap after the run. The latest native run reported 1.6 MB. Removing inactive frame elements reduced the shell frame count from 5 or 20 to 1. These counts do not establish process memory recovery. Opacity changes retained frame identity. The standalone narrow run observed reduced-motion preference. Actual keyboard traversal, text selection, responsive content replacement, individual animation suppression, and long-run memory recovery remain open.

Embedded tests checked opaque-origin access and observed no fixture messages or sink hits for the exercised script, handler, image, style, font, nested-frame and SVG request cases. Direct navigation to the restrictive HTTP response in Edge produced CSP/origin blocks, no script or handler marker, and no sink hit. The HTTP-header path was not run in the native WebView. Navigation and meta refresh, an attempted form submission, privileged bridge isolation, deceptive UI, broader SVG/CSS cases, and rendering limits for expensive content remain unverified. The fixture byte cap is not a production content validator. Keep the resulting controls in scope for [security issue #5](https://github.com/ericslandry/contextarium/issues/5).

## Evidence and remaining experiments

The local disposable evidence is under `C:\workspace\ctx-redesign-validation`. The native event log is `native-events.jsonl`. The deterministic checks are `state.test.mjs` and `transport.test.mjs`. The standalone harness is `edge.mjs` with five `edge-*.png` captures. On the existing local consolidation checkout, `node tests/smoke.mjs` and `node --test tests/transport.mjs tests/layout-test.mjs` also passed. No probe code is included in this documentation branch.

The installed `workflow.d.ts` exposes workflow-local `CustomAgentConfig` definitions and an opaque `ctx.agents` reference for `ctx.agent`. The installed `types.d.ts` declares a per-agent tool list and named skill preload. A single-agent probe is staged in `staged-live-workflow.mjs` with an explicit empty tool list, a named synthetic skill, an output schema, and a timeout. It passed syntax checking and was never registered or run. GitHub documents that workflow subagents inherit session permission grants. Verify effective tool exposure before treating the tool list as a security boundary. If native Workflows cannot enforce that boundary, evaluate the independent SDK session path using existing authorization. [GitHub Dynamic Workflows permissions](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/dynamic-workflows#permissions-for-dynamic-workflows) For a live timing comparison, the minimum proposed budget is **three model calls**: one baseline foreground response, one background composition, and one concurrent foreground response. Confirm that the fresh session has a model available before any call. Use synthetic content, observe only redacted event metadata and available usage counters, and run only with explicit approval. This would test real turn ordering and concurrency while checking available tools, skill resolution, host-visible output, and cancellation. The remaining rendering work can proceed with deterministic fixtures.
