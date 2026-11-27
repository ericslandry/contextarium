# Validation record — Copilot Canvas experiment

## Verified during initial implementation (2026-11-26)

Historical results from before the rename to Contextarium. Blob identities below refer to that revision; the rebranded files require a new test run.

- At that time the canonical index.html blob SHA was `81b47b1d86f0ead669400a9c999ef9b03bf546b5`, unchanged from before the experiment. Changes were made only under this experimental directory.
- All 11 scaffold files were committed and read back from main. Follow-up hardening introduced per-renderer epoch fencing and optional, disabled-by-default manual zoom prompting.
- Node.js v22.16.0: `node --test test.mjs` passed **3/3** tests using exact committed broker, server and test sources (verified by Git blob hashes) with minimal synthetic HTML/JSON/bridge fixtures. This exercises actual loopback HTTP and SSE but uses simulated renderer acknowledgements.
  - Correlated replies and stale client rejection.
  - Error and timeout handling (timeout reports unknown outcome).
  - Server injection of bridge reference, rejection of unauthenticated path and cross-origin acknowledgement, SSE request and HTTP acknowledgement round trip.

Tested blob identities: broker.mjs `7de8dd07baf28347afbd4a2f2369d530b6cf6990`; server.mjs `37d951b3848346477b2ad87e340c9557bb648cce`; test.mjs `a0263c120f08c276acddc6d20eb4f5a382a48ef7`.

## Not verified

- Running the actual Contextarium HTML with browser.mjs and the demo provider.
- Installing and loading this experimental extension with the user's actual Copilot app and bundled SDK.
- Invoking canvas actions from a live Copilot agent, the exact behavior of session.send(mode: enqueue), prompts while busy, and whether iframe origin/SSE restrictions require changes.
- Full end-to-end agent composition, camera veto/arrival feedback, opt-in zoom heuristics, reconnect and proactive updates in the real panel.
- Production security and full machine-readable schema coverage. Current action schemas constrain message shapes; the existing runtime is the final validator. Use synthetic data only.

## Local go/no-go order

1. Run prepare.mjs, node --test test.mjs, and demo.mjs in an ordinary browser. Verify the new card and timed update.
2. Review the installed SDK guide, run prepare.mjs --install and reload the extension.
3. Open canvas ID contextarium-experiment; ask the agent to inspect_workspace and apply_commands with an upsert.
4. Ask for more context using the UI. Verify the agent is invoked in the same session; repeat while the agent is busy.
5. Verify unsolicited updates, camera takeover, opt-in zoom, and a fresh independently composed scene.
6. Record observed incompatibilities; adjust or remove experimental modules only. Do not change the canonical runtime as part of this investigation.
