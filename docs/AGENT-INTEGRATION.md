# Connected workspace integration

Contextarium exposes a [browser API and versioned scene contract](SCENE-CONTRACT.md). Embedded and imported scenes can run offline. A static same-origin server can return registered JSON command arrays. Connected hosts use the same renderer and provide incremental composition, state inspection and push.

## Connected operation

1. The host creates a session-scoped loopback workspace with `connect/server.mjs` and a provider callback.
2. The browser connects over SSE. Host calls request a snapshot, validated command batch, scene replacement or layout measurement. The browser acknowledges each call over HTTP.
3. The host inspects the current revision and renderer epoch before applying commands. It receives the resulting revision and any camera veto. On a missing acknowledgement or after reconnect, inspect again before deciding whether to retry.
4. The browser reports declared events. A provider can request an update independently of those events. Explicit user controls can request follow-up, and the manual-zoom prompt heuristic is off by default.

The native Copilot adapter supplies the host callback via `session.send` in enqueue mode. The deterministic provider in `dev/demo.mjs` adds a detail card and issues a timed update over the same path. The [authoring guide](AUTHORING.md) describes the actions and rules for designing a scene.

## Scope

The loopback protocol is an internal integration boundary for a local workspace. The browser serves JSON as data and applies only declared commands. The provider owns domain authorization and external side effects. The current transport uses one renderer per workspace, keeps a bounded event history, and provides no automatic replay or persistent sync. For security and scope details, see the [architecture](Contextarium-Architecture.md).
