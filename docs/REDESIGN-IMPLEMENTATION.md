
# Contextarium redesign implementation report

**Baseline** [d759547](https://github.com/ericslandry/contextarium/commit/d7595479c44ad21defa3447ec06a1264b6df2547)  
**Development branch** `prototype/clean-redesign`  
**Prototype package** `contextarium-redesign` 0.1.0

The redesign shipped under the existing Contextarium package as 0.3.1. The historical observations below describe the separately installed preview unless identified as promotion checks. A deterministic browser demo remains available.

| Milestone | Implemented | Verified |
| --- | --- | --- |
| Spatial engine | Shared-document HTML/CSS/SVG/JS, stable compositions with cooperative lifecycle, multiscale navigation, pointer-centered zoom, touch pan/pinch, focus, history, breadcrumbs and human camera precedence. | Both scenes in Edge and native Canvas. A real native click stepped the authored buffer simulation from zero to one. Keyboard selection focused the simulation and turned Follow off. |
| Workspace management | Session-owned revisions and generation, incremental SSE publication, view-scoped reconnect snapshots, stale result rejection, document import/export, browser-owned presentation. | Authority and transport tests passed. A trusted reading-room JSON file imported in the native Canvas and executed its authored script. A separate trusted import restored the relay. The browser suite covered cleanup, camera fencing, reconnect logic through the transport suite, and preserved simulation state through an unrelated update. |
| Copilot integration | Dynamic Workflow registration, explicit visualization action, opt-in autonomous composition, session-bound event observation, coalescing and cancellation. | Native Copilot installed and opened the extension in a fresh no-repository session. A deterministic SDK substitute drove the actual extension from root events through workflow result, workspace commit and live SSE, and checked shutdown cancellation. The standalone browser demo drove the same observer/coordinator/renderer with synthetic conversation. The approved live retry on `143dcdf` ran the explicit foreground request through a native workflow to a visible model-authored revision. Two live automatic runs each admitted one workflow from a completed foreground reply. The first returned no changes. The retry published a worked backlog graphic inside the existing Buffer Lab composition. |
| Authoring | One package-local authoring guide is both a bundled skill and the exact instruction source read by the workflow extension. Candidate envelopes validate layout metadata and revision without prescribing visuals. | The adapter test checked canonical guidance delivery. Native package startup read the guide successfully. The architecture diagram with interactive buffer simulation and the reading room use materially distinct authored layouts. Model adherence and authoring efficiency remain unmeasured. |
| UX | Native overview and focused views, plus deterministic desktop and narrow-browser checks. | The native panel revealed that the initial WebView could be sized at zero. The renderer now defers fitting until dimensions are usable, and the browser regression test opens initially at a 1 × 1 viewport. Focus and manual interaction were checked after the fix. The narrow reading composition was reworked to use readable single-column type. |

## Verification

- **7 prototype regression tests passed** using Node **24.22.3** and Edge **158.0.4370.45**. Run `node --test prototype/tests/*.test.mjs`. Set `CONTEXTARIUM_BROWSER` on systems without the default Windows Edge path.
- The existing local shipping checkout at `3c3c902` passed the smoke command and **8 existing tests** through `node --test tests/transport.mjs tests/layout-test.mjs`. The new package's tests are independent.
- The Edge test rendered the relay overview at **1280 × 800** and the reading focus at **430 × 660**, with checks for scoped CSS, shared SVG document ownership, typography and scroll width. The focused reading body projected at least **13 CSS px**. The narrow two-composition synthetic zoom run produced **17.0 ms p95** across **79** animation-frame intervals. This is a standalone, two-composition sample with its own workload. It does not establish native performance or a comparison with the historical iframe stress test.
- Native installation used Copilot desktop **1.5.0** and the previously established CLI **1.0.115-7** / SDK protocol **4** environment. The prototype was installed from its local marketplace and left open for review. The private branch marketplace installation and upgrade lifecycle were not exercised. The initial installation and deterministic verification used no Copilot model calls.

## Native host boundary

The prototype's loopback protocol serves documents, revisions and presentation state. It does not export a host-operation endpoint or put an SDK object in the renderer. The transport test rejected other origins and found no workflow-start or deterministic-demo endpoint in native mode. A benign authored script loaded by native import confirmed that it shared the renderer document. It observed `window.__TAURI_INTERNALS__.invoke` and `window.chrome.webview.postMessage` as functions supplied by the host. It observed no `window.__TAURI__` or Node `require` global. The fixture inspected availability without invoking either messaging interface. Command authorization on those ambient host surfaces remains unverified. Contextarium does not register handlers on them or weaken host protections. Browser-originated requests are subject to the browser and host, and do not pass through Copilot's agent tool-approval system.

## Live Buffer Lab acceptance

One synthetic foreground request asked Copilot to invoke `request_visualization` once and add a comparison of 4 versus 8 arrivals per tick at a service rate of 5. Copilot invoked the action, which returned “Provide a visualization intent.” No background run was queued, no workspace revision was published, and camera precedence could not be exercised against an update.

The installed SDK passes a `CanvasProviderInvokeActionRequest` envelope to the callback. The writable actions had read their fields from the envelope root instead of `input`. The prototype now uses `input` for both actions. The deterministic adapter test dispatches the full SDK envelope, verifies explicit publication, and verifies that a foreground acknowledgement while automatic composition is paused does not invalidate and rerun the explicit job.

### Successful retry

The approved retry opened commit `143dcdf` in a fresh native No repository session with Copilot Fusion Standard. The foreground request used `request_visualization` once and acknowledged queuing. The desktop showed one `contextarium-compose` workflow, running separately from chat, then showed it **Completed in 11 s**. The Canvas reported **Workspace updated** and visibly added a model-authored **4 vs 8 samples per tick** comparison below Buffer Lab. It showed the correct fifth-tick backlogs of **0 and 15** and kept the three starter compositions.

The camera remained at **26%** with Follow off. The existing compositions stayed in their prior positions in before/after screenshots. The prompt asked the worker to return a focus target. The serialized focus field was not independently inspected, so the observation establishes that this live publication did not move the camera. Automatic composition remained paused for this test.

## Automatic curation event replay

The captured desktop event sequence from the successful explicit test exposed two mismatches with the original fixture. Copilot attached a parent-task identifier to the root user event, and one logical foreground request occupied three SDK turns. The first two turns requested tools. The final turn provided the user-visible reply. Worker events carried agent attribution and shared the interaction identifier.

The observer now uses a matching root turn and reply to attribute the user event, retains the user request across intermediate tool turns, and deduplicates logical completion. A sanitized replay of the recorded journal emitted exactly one foreground pair and excluded worker output. An automated regression covers the same event structure and replay. This was an offline replay. The live test below subsequently verified automatic admission and a deliberate no-change outcome.

## Live automatic curation test

A fresh native session enabled automatic curation during a foreground request about a new Buffer Lab example. The request explained arrivals of 10, 0, 10, 0 at a service capacity of 5 and asked for a chat response without an explicit visualization action. Copilot replied and Contextarium started exactly one automatic workflow. The desktop showed it as completed after **4 s**. The worker input in the test journal included the completed foreground request and answer, with request kind `conversation`.

The worker returned empty `upsert` and `remove` arrays and a null `focusId`. The Canvas showed **Workspace is current**. This verifies live automatic admission, context delivery and the no-change path. It did not exercise automatic publication of a visually useful candidate. There was no recursive or duplicate workflow during the observation, and the second approved foreground request paused automatic curation with the workflow count still at one.

The authoring skill now calls out new worked examples as candidates for visual updates, including substantive turns that also change a setting, while retaining no-change for administrative or redundant turns. The revision also corrects the skill's front matter placement. The native adapter test checks that only the guide body is sent, and the browser test waits for the observed manual zoom before checking camera stability. All seven regression tests passed. The live retry below exercised this revision.

## Live automatic curation retry

A fresh native No repository session loaded the updated guide at [e0583ea](https://github.com/ericslandry/contextarium/commit/e0583ea8afa1af40ec7bddb90229cc8ad65ddaca). With Copilot Fusion Standard, the first approved foreground request enabled curation and asked the same synthetic Buffer Lab question without an explicit visualization action. Fusion selected GPT-6 Luna for the foreground reply. The chat returned the correct **5, 0, 5, 0** backlog and showed the session as idle while the single `contextarium-compose` Dynamic Workflow was still running. The native workflow panel reported **Completed 17 s**.

The Canvas reported **Workspace updated**. The existing Buffer Lab composition gained a graphic whose accessible description specified arrivals of **10, 0, 10, 0**, backlogs of **5, 0, 5, 0**, and service capacity of **5 per tick**. The other two starter compositions remained present, and the overview stayed at **26%** with Follow off. The second approved foreground request paused automatic curation. Once chat returned to idle, the Canvas confirmed the pause and the desktop still showed one workflow. The test used two foreground requests and one background run. It establishes publication and nonblocking behavior for this scenario. The worker model, request accounting, and repeatability across other conversations were not measured.

## Promotion to the Contextarium package

Version 0.3.1 adopts the tested runtime under the existing marketplace, package, extension and Canvas IDs. The observations above apply to the original preview configuration. The production entry uses the same workflow and rendering code. The marketplace keeps one Contextarium entry. In Copilot Desktop 1.5.0, refreshing the existing `copilot-plugin` marketplace and choosing Update reported **Version 0.2.0 to 0.3.0** for `contextarium@contextarium`. The bundled skill appeared under the updated plugin. A fresh no-repository session opened the starter workspace under the original Canvas launcher, and a click on Step changed the queue from zero to one. The upgrade check used no Copilot prompts. The 0.3.1 patch corrects the tab title and shows the paused status on startup. Copilot treats the installed version as current even after a catalog refresh, so the patch uses a new version. Legacy declarative exports can still be opened in the retained 0.2.0 viewer. See the [update and rollback guide](COPILOT-PLUGIN.md).

## Remaining acceptance

The user can review and exercise the installed prototype without model calls. The explicit live request path is verified. Live automatic curation is verified for both a no-change result and publication of a substantive update. Each tested sequence admitted one run, and pausing produced no additional workflow. Automatic composition defaults to paused per session. This limits model use while the host event behavior is being confirmed. The prototype uses a separate package and Canvas identity during evaluation and a new versioned JSON format. The promoted package keeps a separate workspace format and preserves older access through the legacy viewer.

Broader native performance, keyboard and screen-reader behavior for authored compositions, live workflow cancellation and usage, and the host's ambient messaging authorization remain open. See the [architecture](REDESIGN-PROTOTYPE.md), [installation guide](../prototype/README.md) and [canonical authoring skill](../prototype/skills/contextarium/SKILL.md).
