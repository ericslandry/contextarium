# Contextarium validation history

The entries below record the experiment as tested at the time. For current procedures, see the [README](../README.md) and [plugin guide](COPILOT-PLUGIN.md).

## Desktop acceptance and marketplace packaging

- The [live layout acceptance check](https://github.com/ericslandry/contextarium/issues/1#issuecomment-7216967858) in Copilot desktop 1.5.0 found 8 errors and 4 warnings in the original fixture. Copilot repaired the scene and verified zero findings across three viewport samples.
- [Native packaging validation](https://github.com/ericslandry/contextarium/pull/3) verified authenticated private marketplace installation, fresh sessions with and without a repository, and a native update from 0.1.0 to 0.1.1. Disable, uninstall and reinstall were exercised without submitting a chat prompt.

## Layout regression for issue #1

- [The Lumen Harbor fixture](../tests/fixtures/lumen-harbor-original.json) records the synthetic scene passed to the original live `load_scene` call.
- Node.js 24.22.3 and headless Edge 158 ran `node --test test.mjs layout-test.mjs` with 8 passing tests, including the browser suite and its four subtests. The repository smoke test also passed. The browser suite exercises the production experimental server, SSE/HTTP bridge, canonical renderer and Canvas action handlers with a deterministic provider.
- Chromium measured 145 units of occupied content in the original 130-unit metric and reported a 270.4-unit heading zone where a card began at y = 120. Candidate preview reproduced the obstruction while preserving the authoritative workspace. The mock agent resized and moved objects with normal commands, remeasured after heading text wrapped, and obtained zero layout errors in the 520 × 980 overview, 440 × 650 metric focus, and 1000 × 720 findings samples. The heading and metrics passed the respective 10-pixel overview and 12-pixel detail checks.
- Additional cases cover ancestor containment, sibling overlap, child escape, hidden objects, touching edges, semantic variants, unreadable text, intended table scrolling, stale revisions and the live-DOM validation route.
- The installed SDK constructed a Canvas with the new action declaration. The live Copilot/WebView acceptance check for this change is pending. Desktop automation ended during browser setup because it could not verify the browser URL. **Copilot prompts used for issue #1: 0.**

Validation reports sampled geometry and font size. It does not establish contrast, subjective visual clarity, or behaviour at every camera position. New scenes can be measured before publishing and agents remain responsible for correcting their composition. Preview mode suppresses behaviours and data sources, so validate the live scene after dynamic content arrives.

## Local desktop validation (2026-11-27)

- Baseline was GitHub `main` at `3f36b59d2c59bd1de5f0417ad10c347e04d3e78f`. Direct shell clone was blocked by GitHub DNS in the execution environment. The Copilot app cloned the repo to `C:\Users\erics\work\ericslandry_contextarium`. Local and remote-tracking `main` both matched the GitHub SHA. A Git bundle from that checkout seeded the writable validation clone in `C:\workspace\contextarium-main`.
- Node.js 24.22.3 passed `node prepare.mjs`, all three `node --test test.mjs` tests, and the repository `node tests/smoke.mjs`. The standalone demo started and printed a loopback URL. Desktop Chrome and the in-app browser timed out reaching that server, so the ordinary-browser button and timed-provider demo remain unverified. The actual render and event transport were exercised in Copilot independently.
- GitHub Copilot desktop 1.5.0 bundles SDK protocol version 4. Its resolver accepts `@github/copilot-sdk/extension`, and the installed module exports `createCanvas`, `CanvasError` and `joinSession`. Installed declarations and JavaScript register canvases from `canvases.definitions`. Changed the entry point from an array to `{ canvases: { definitions: [canvas] } }`. The installed request IDs, `{url,title}` open result and `session.send({mode:"enqueue",prompt})` are compatible.
- The default user-scope installer returned `EPERM` when creating the extension directory. The installer succeeded with a temporary `COPILOT_HOME`. A copy was installed in a disposable local repository under the experiment, and the user approved that repository in Copilot. The first generated Copilot worktree omitted the untracked fixture and returned “Extension ‘contextarium-experiment’ not found.” Committing the fixture in that local test repository and opening a new session made the provider discoverable. No user-wide install was made.

| Desktop checkpoint | Observed result |
|---|---|
| Render, map and narrow panel | Copilot listed and opened `contextarium-demo`. The narrow panel rendered the scene, the Ask button and camera controls. Map and pan responded. The first inspect returned `renderer not connected` before the iframe attached, then a fresh inspect succeeded at revision 0. |
| Agent → UI | The agent added and focused a synthetic card and set the risk metric to `SYNTHETIC-123`. The visible card and the follow-up inspect confirmed the result at revision 1. |
| UI → agent and busy queue | The Ask button submitted to the same chat. A second click while the first turn was active showed **1 queued message**. The two turns added and then expanded a detail card at revisions 2 and 3. |
| Independent update and camera authority | Manual drag switched Follow off. A separate chat-initiated upsert committed at revision 4, while its accompanying focus request was vetoed with `human-control`. Camera coordinates were unchanged and `recent_events` included `camera.interrupted`. |
| Stale and invalid commands | A stale revision returned `stale workspace; inspect again`. An invalid delete returned `Invalid target`. Live reinspection showed revision 4 and the expected card and metric. The broker test covers acknowledgement timeout with a simulated renderer. |
| Composition | Copilot read the authoring guide and loaded a fresh fictional service-health scene with no external sources. The panel displayed the Lumen Harbor overview, findings, and remediation boards. `load_scene` returned revision 0 and advanced the bridge epoch. The scene's initial threshold rule then updated its note, so the first inspection saw revision 1. Some authored text overlapped at the tested narrow zoom level. |
| Manual zoom opt-in | With the checkbox selected and the camera centered at scale 0.6, one wheel gesture crossed the declared 0.9 threshold. Follow switched off, and the same session received one automatic prompt for `zoom-target`. Copilot added a detail board at revision 3 and left the camera at the manually chosen position. With Follow on, separate zero-duration `camera.set` moves produced a confirmed `camera.leave` at 0.6 and subsequent `camera.enter` at 1.1. No second prompt appeared. |
| Reload and stale renderer epoch | One `extensions_reload` reconnected the existing Canvas instance without reopening it. The original briefing returned at revision 0 with a new renderer epoch. The composed scene had been in memory and was lost. An upsert carrying the old epoch and the current revision returned `stale workspace; inspect again`. Reinspection confirmed the probe object was absent. |

The renderer startup race is observable on an immediate inspect. Retry the read after the panel shows **Canvas connected**. The panel status can continue to say **Prompt submitted; awaiting agent action** after the agent's mutation has rendered. Results use synthetic data only.

## Verified during initial implementation (2026-11-26)

Historical results from before the rename to Contextarium. Blob identities below refer to that revision; the rebranded files require a new test run.

- At that time the canonical index.html blob SHA was `81b47b1d86f0ead669400a9c999ef9b03bf546b5`, unchanged from before the experiment. Changes were made only under this experimental directory.
- All 11 scaffold files were committed and read back from main. Follow-up hardening introduced per-renderer epoch fencing and optional, disabled-by-default manual zoom prompting.
- Node.js v22.16.0: `node --test test.mjs` passed **3/3** tests using exact committed broker, server and test sources (verified by Git blob hashes) with minimal synthetic HTML/JSON/bridge fixtures. This exercises actual loopback HTTP and SSE but uses simulated renderer acknowledgements.
  - Correlated replies and stale client rejection.
  - Error and timeout handling (timeout reports unknown outcome).
  - Server injection of bridge reference, rejection of unauthenticated path and cross-origin acknowledgement, SSE request and HTTP acknowledgement round trip.

Tested blob identities: broker.mjs `7de8dd07baf28347afbd4a2f2369d530b6cf6990`; server.mjs `37d951b3848346477b2ad87e340c9557bb648cce`; test.mjs `a0263c120f08c276acddc6d20eb4f5a382a48ef7`.

## Not verified in the initial implementation

- Running the actual Contextarium HTML with browser.mjs and the demo provider.
- Installing and loading this experimental extension with the user's actual Copilot app and bundled SDK.
- Invoking canvas actions from a live Copilot agent, the exact behavior of session.send(mode: enqueue), prompts while busy, and whether iframe origin/SSE restrictions require changes.
- Full end-to-end agent composition, camera veto/arrival feedback, opt-in zoom heuristics, reconnect and proactive updates in the real panel.
- Production security and full machine-readable schema coverage. Current action schemas constrain message shapes; the existing runtime is the final validator. Use synthetic data only.
