
# Contextarium redesign implementation report

**Baseline** [d759547](https://github.com/ericslandry/contextarium/commit/d7595479c44ad21defa3447ec06a1264b6df2547)  
**Development branch** `prototype/clean-redesign`  
**Prototype package** `contextarium-redesign` 0.1.0

The [prototype](../prototype/) is installable through a separate Copilot marketplace entry and has a browser demo driven by deterministic events. The shipping package retains its existing identity, runtime and entry. The branch catalog adds a separate prototype entry.

| Milestone | Implemented | Verified |
| --- | --- | --- |
| Spatial engine | Shared-document HTML/CSS/SVG/JS, stable compositions with cooperative lifecycle, multiscale navigation, pointer-centered zoom, touch pan/pinch, focus, history, breadcrumbs and human camera precedence. | Both scenes in Edge and native Canvas. A real native click stepped the authored buffer simulation from zero to one. Keyboard selection focused the simulation and turned Follow off. |
| Workspace management | Session-owned revisions and generation, incremental SSE publication, view-scoped reconnect snapshots, stale result rejection, document import/export, browser-owned presentation. | Authority and transport tests passed. A trusted reading-room JSON file imported in the native Canvas and executed its authored script. A separate trusted import restored the relay. The browser suite covered cleanup, camera fencing, reconnect logic through the transport suite, and preserved simulation state through an unrelated update. |
| Copilot integration | Dynamic Workflow registration, explicit visualization action, opt-in autonomous composition, session-bound event observation, coalescing and cancellation. | Native Copilot installed and opened the extension in a fresh no-repository session. A deterministic SDK substitute drove the actual extension from root events through workflow result, workspace commit and live SSE, and checked shutdown cancellation. The standalone browser demo drove the same observer/coordinator/renderer with synthetic conversation. Live foreground event attribution and a model-generated Canvas update on this build await approval. |
| Authoring | One package-local authoring guide is both a bundled skill and the exact instruction source read by the workflow extension. Candidate envelopes validate layout metadata and revision without prescribing visuals. | The adapter test checked canonical guidance delivery. Native package startup read the guide successfully. The architecture diagram with interactive buffer simulation and the reading room use materially distinct authored layouts. Model adherence and authoring efficiency remain unmeasured. |
| UX | Native overview and focused views, plus deterministic desktop and narrow-browser checks. | The native panel revealed that the initial WebView could be sized at zero. The renderer now defers fitting until dimensions are usable, and the browser regression test opens initially at a 1 × 1 viewport. Focus and manual interaction were checked after the fix. The narrow reading composition was reworked to use readable single-column type. |

## Verification

- **6 prototype regression tests passed** using Node **24.22.3** and Edge **158.0.4370.45**. Run `node --test prototype/tests/*.test.mjs`. Set `CONTEXTARIUM_BROWSER` on systems without the default Windows Edge path.
- The existing local shipping checkout at `3c3c902` passed the smoke command and **8 existing tests** through `node --test tests/transport.mjs tests/layout-test.mjs`. The new package's tests are independent.
- The Edge test rendered the relay overview at **1280 × 800** and the reading focus at **430 × 660**, with checks for scoped CSS, shared SVG document ownership, typography and scroll width. The focused reading body projected at least **13 CSS px**. The narrow two-composition synthetic zoom run produced **17.0 ms p95** across **79** animation-frame intervals. This is a standalone, two-composition sample with its own workload. It does not establish native performance or a comparison with the historical iframe stress test.
- Native installation used Copilot desktop **1.5.0** and the previously established CLI **1.0.115-7** / SDK protocol **4** environment. The prototype was installed from its local marketplace and left open for review. The private branch marketplace installation and upgrade lifecycle were not exercised. No Copilot model calls were made.

## Native host boundary

The prototype's loopback protocol serves documents, revisions and presentation state. It does not export a host-operation endpoint or put an SDK object in the renderer. The transport test rejected other origins and found no workflow-start or deterministic-demo endpoint in native mode. A benign authored script loaded by native import confirmed that it shared the renderer document. It observed `window.__TAURI_INTERNALS__.invoke` and `window.chrome.webview.postMessage` as functions supplied by the host. It observed no `window.__TAURI__` or Node `require` global. The fixture inspected availability without invoking either messaging interface. Command authorization on those ambient host surfaces remains unverified. Contextarium does not register handlers on them or weaken host protections. Browser-originated requests are subject to the browser and host, and do not pass through Copilot's agent tool-approval system.

## Live Buffer Lab acceptance attempt

One synthetic foreground request asked Copilot to invoke `request_visualization` once and add a comparison of 4 versus 8 arrivals per tick at a service rate of 5. Copilot invoked the action, which returned “Provide a visualization intent.” No background run was queued, no workspace revision was published, and camera precedence could not be exercised against an update.

The installed SDK passes a `CanvasProviderInvokeActionRequest` envelope to the callback. The writable actions had read their fields from the envelope root instead of `input`. The prototype now uses `input` for both actions. The deterministic adapter test dispatches the full SDK envelope, verifies explicit publication, and verifies that a foreground acknowledgement while automatic composition is paused does not invalidate and rerun the explicit job. The corrected build has not yet been exercised with another live Copilot prompt.

## Remaining acceptance

The user can review and exercise the installed prototype without model calls. End-to-end live acceptance still needs an authorized Copilot run from foreground conversation through the native workflow to a model-authored workspace revision, and a separate observation of autonomous event attribution and worker-event exclusion. Automatic composition defaults to paused per session. This limits model use while the host event behavior is being confirmed. The prototype uses a separate package and Canvas identity during evaluation and a new versioned JSON format. Legacy scene import and eventual shipping identity compatibility are release decisions.

Broader native performance, keyboard and screen-reader behavior for authored compositions, live workflow cancellation and usage, and the host's ambient messaging authorization remain open. See the [architecture](REDESIGN-PROTOTYPE.md), [installation guide](../prototype/README.md) and [canonical authoring skill](../prototype/skills/contextarium/SKILL.md).
