
# Contextarium prototype architecture

This document describes the runtime promoted to Contextarium 0.3.0, based on [the agreed redesign](REDESIGN.md) and [the revised feasibility gates](REDESIGN-FEASIBILITY.md). The existing Contextarium extension registers the runtime and serves the workspace. The runtime, example compositions, bundled skill and deterministic tests live under [prototype/](../prototype/).

~~~mermaid
flowchart TB
    F["Copilot conversation"]
    A["Native extension and coordinator"]
    W["Dynamic Workflow worker"]
    S["Session workspace authority"]
    R["Shared-document renderer"]
    F -->|"Completed root turns and explicit intent"| A
    A -->|"Current context snapshot"| W
    W -->|"Structured candidate"| A
    A -->|"Validated revision"| S
    S -->|"Snapshot and deltas"| R
    R -->|"Presentation metadata"| A
~~~

The prototype uses three kinds of freshness. A workspace generation changes on import or teardown. A content revision changes on a coherent commit. A foreground context sequence invalidates older job input. The browser alone owns camera, selection, follow state and navigation history. A focus request is stamped with the renderer identity and camera epoch captured when the job started. It can be ignored while the valid content update applies. Breadcrumb ancestry is independent of geometric coordinates.

The extension joins the native session and registers a Dynamic Workflow. It begins observing when the Canvas opens or a native action activates the workspace. It hands the worker recent completed foreground context, explicit intent when present, geometry, and bounded source previews. The worker uses the session's native tool permission model. The coordinator runs one active job, coalesces conversation turns and favors explicit requests. It drops obsolete results, retries a still-relevant explicit request against current context, and cancels work on reset or shutdown via the workflow API. Root turn identity, initiating user-message or interaction IDs, checkpoint markers and worker attribution are used to select conversation data. Ambiguous events are skipped. The runtime neither attempts to reconstruct historical transcripts nor uses browser navigation as a model trigger.

The loopback service exposes renderer assets, a session-view event stream, presentation metadata and import/export. It listens only on 127.0.0.1 with per-view URLs and checks the origin of browser mutations. The page receives no Copilot SDK client, session credential, workflow trigger or generic command endpoint. The demo-only deterministic route exists only in the standalone fixture server. Enabling automatic composition and requesting work use native Copilot actions. The prototype adds no browser path to shell, filesystem or native tool dispatch. Agent availability and permissions are still governed by the host.

Each composition is an independently addressable HTML/CSS/SVG/JavaScript surface in the same document. A world transform projects its absolute geometry. `@scope` and cooperative cleanup prevent common authoring collisions. JavaScript runs with `root` and `lifecycle` arguments, and can also use normal browser globals. It can affect the entire document and use browser network access available to the WebView. CSS scoping is an authoring convention. Copilot tool approval is not a browser network check. Keep imports and resources within the accepted trusted-local workflow. For keyboard and text-heavy accessibility, use native controls and preserve selectable text. The fixture simulation uses the Web Animations/CSS and timer primitives available to ordinary content.

The [canonical skill](../prototype/skills/contextarium/SKILL.md) is read from the installed package for the workflow's instructions and bundled for native skill discovery. This avoids the workflow-local skill preload field rejected by the installed SDK. See the [installation and demo instructions](../prototype/README.md) and [implementation report](REDESIGN-IMPLEMENTATION.md).
