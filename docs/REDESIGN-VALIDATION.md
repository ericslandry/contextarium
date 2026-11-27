# Contextarium redesign validation

**Date** November 27, 2026  
**Scope** [Redesign feasibility gates](REDESIGN-FEASIBILITY.md#6-targeted-handoff-work-validation-protocol). Disposable local plugin, synthetic inputs, and deterministic workflow code.

## Decisions

- Keep Dynamic Workflows as the first candidate for background composition. The installed host ran and cancelled deterministic work and delivered its structured result to a visible Canvas. The Fusion run demonstrated live foreground and background overlap in one session. Adoption still depends on proving composition-only permissions and collecting representative latency, usage, and host-behavior evidence.
- Keep opaque, script-free iframe compositions as the rendering prototype. The WebView rendered rich HTML and SVG. The measured zoom cadence calls for limiting live frames and profiling culling before setting release budgets. Complete structural content validation and the remaining isolation cases before admitting generated markup.
- Keep one session-owned workspace writer, with workspace revision, conversation freshness, and camera epoch checked independently. The deterministic probe passed these checks and demonstrated full snapshot recovery.

## Gate results

| Gate | Status | Evidence and limits |
| --- | --- | --- |
| 0. Environment and install | Pass for the zero-model probe | GitHub Copilot desktop **1.5.0**, local Node **24.22.3**, standalone Edge **158.0.4370.45**. The installed CLI package reports **@github/copilot 1.0.115-7** and the bundled SDK declaration specifies protocol **4**. The exact SDK package version and the WebView runtime selected by the host were not independently confirmed. The native local marketplace exposed the probe plugin, extension, and Canvas. |
| 1. Foreground observation | Partial | The native observer registered in separate session processes and recorded workflow and shutdown events. The deterministic observer test exercised session filtering, deduplication, redaction, worker filtering, and unsubscribe. The isolated baseline showed ordered user message, assistant turn start, assistant message and turn end. During concurrency the listener received interleaved events, so first-text attribution needs correlation by turn or message ID. Native replay and cross-session isolation of real conversation events remain unverified. |
| 2. Background runtime | Pass for deterministic execution and one Fusion overlap sample. | Three deterministic completions took **1,522–1,541 ms**. Three deterministic cancellations took **99–127 ms**. The live run completed two foreground turns and one background composition. The concurrent foreground request and worker overlapped for **2,019 ms**. Effective tool grants and workflow retention remain unverified. |
| 3. State and rendering | Pass for the tested paths | Four deterministic state/transport tests passed, covering obsolete jobs, session fencing, atomic rejection, duplicate and reordered snapshots, import and reset, camera takeover, disconnect, reconnect, and teardown. In a fresh native **No repository** session, the completed workflow published revision 1, the trusted WebView shell displayed it, and the renderer acknowledged it **157 ms** after publication. The cancelled run produced no result. Foreground progress was simulated in the standalone test. |
| 4. Isolation and spatial quality | Partial | Styled HTML and tables, SVG paths, gradients and masks, and CSS animation rendered in standalone Edge and native WebView. The fixtures used opaque, script-free frames and a restrictive CSP. The tested local request sink received zero requests. Performance and the remaining security and accessibility cases are detailed below. |
| 5. Skill and lifecycle | Partial | The disposable skill, extension and Canvas were discoverable in Installed. A fresh no-repository session loaded the local source changes, and a refreshed Installed view showed **0.0.3**. Per-plugin **Update** and **Uninstall** both returned “Plugin is not installed” while the UI listed it. **Remove and uninstall** on the disposable marketplace succeeded, and Installed returned no matching entries. The workflow-local agent configuration rejects the `skills` field. Other background skill-loading paths remain unverified. |

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

## Approved live-model preflight

The approved comparison allowed up to three synthetic model calls. The corrected disposable plugin (**0.0.4**) registered its workflow and opened its Canvas in a fresh **No repository** desktop session. The foreground model picker showed **No models available** and was disabled. The comparison trigger was left untouched. The disposable log records Canvas startup and close, with no foreground submission or workflow admission. **Zero of the three approved calls were used.**

The installed workflow validator accepted an explicit workflow-local agent with `infer: false` and `tools: []`. It rejected the configuration when `infer` was omitted and separately rejected the named `skills` field, despite that field appearing on the shared `CustomAgentConfig` declaration. Both rejections were reproduced with the bundled SDK before any model turn. The corrected desktop probe used an inline synthetic fixture instruction. Its registration confirms configuration acceptance. Effective model tool exposure still requires runtime evidence. GitHub documents inherited session grants for workflow subagents. [GitHub Dynamic Workflows permissions](https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/dynamic-workflows#permissions-for-dynamic-workflows)

A separate SDK runtime using isolated `empty` mode connected with protocol 4 and reported unauthenticated. The check used no new credentials and did not try to transfer the desktop sign-in. Evidence is in `check-live-prerequisites.mjs` and `live-evidence.jsonl` in the disposable validation directory. The desktop marketplace and its installed components were removed and confirmed absent.

The initial preflight was followed by the Fusion comparison below. The skill preload behavior needs a supported path of its own.

## Live comparison with Copilot Fusion

A fresh native **No repository** session showed **Copilot Fusion · Standard**. The operator activated the disposable Canvas comparison once. It sent one baseline foreground request, started one workflow worker, and sent one concurrent foreground request. Both foreground replies matched their distinct test markers. The completed worker returned the expected structured marker. Three model-usage events were observed, all for **MAI Code 2 Flash**. Copilot showed the two foreground replies and one completed background workflow in its activity panel. The approved three-call budget was used in this run.

| Observation | Measured result |
| --- | ---: |
| Baseline foreground, first observed text | 2,433 ms |
| Baseline foreground, submission to completed response | 2,453 ms |
| Concurrent foreground, submission to completed response | 2,109 ms |
| Concurrent foreground request overlapping the worker's recorded interval | 2,019 ms |
| Background workflow, runtime start to completion | 2,162 ms |
| Worker active time reported by the runtime | 1,994 ms |
| Worker usage reported by the runtime | 0.01017 AI credits |

The foreground completion times are tied to the two `sendAndWait` results and validated markers. The concurrent session listener received two interleaved sets of turn events. It did not preserve message and turn IDs, so its first observed text delta cannot be assigned confidently to the foreground turn. The 344 ms difference in completion times is one baseline and one concurrent sample. It does not establish a latency impact.

The worker ran with `infer: false` and `tools: []`. The session listener reported zero tool starts during the observed turns. The experiment did not enumerate the worker's effective tool catalog or exercise a denial, so the composition-only boundary remains unverified. No live cancellation was attempted within this three-call comparison. The local evidence is in `live-evidence.jsonl`. The disposable marketplace was removed after the run and Installed showed no matching components.
