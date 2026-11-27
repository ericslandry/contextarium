
# Contextarium Redesign

Contextarium is a living spatial workspace for one Copilot session. Start with the estuary relay diagram and its interactive buffer simulation. Ask Copilot to visualize a topic and it can dispatch a background composition that updates the same workspace. The reading room example uses an editorial layout with selectable prose.

## Run the deterministic demo

Use Node 24 or later.

~~~sh
node prototype/runtime/demo.mjs
~~~

Open the printed loopback URL in Edge or Chromium. Select the two scenes from the demo menu and use **Run demo update** to feed a synthetic completed conversation into the same observer, coordinator, authority and renderer used in the plugin. The demo does not connect to Copilot.

Use the **Focus…** picker or double-click open space inside a composition to fly to it. Wheel zooms towards the pointer. Drag the empty background, hold Space while dragging, or use the middle mouse button to pan. On a focused workspace, arrow keys pan and plus/minus zoom. Touch supports pan and pinch. **Back**, **Forward**, **Overview** and breadcrumbs navigate viewpoints. Manual navigation turns **Follow** off. Re-enable it explicitly to accept guidance again.

## Install in GitHub Copilot desktop

Use a local checkout of the development branch.

1. In **Customize → Add → Manage marketplaces**, add the absolute path to the checkout's `prototype` directory.
2. Select **Customize → Add → Plugin** and install `contextarium-redesign@contextarium-redesign`.
3. In **Customize → Installed**, find **Contextarium Redesign** under Canvas and choose **New session → No repository**.
4. To start live composition, ask Copilot to use **request_visualization** for an explicit visualization. To continuously curate completed conversation turns, ask it to enable **set_automatic_composition**. Automatic composition is initially paused in every session. Both live paths may consume Copilot model usage. Pause it through the same action.
5. For this local marketplace, **Manage marketplaces → Remove and uninstall** removes the prototype. The shipping Contextarium plugin has its own identity.

The branch marketplace catalog also includes the redesign as a separate entry. The local installation procedure is the verified path for this prototype.

## Open and save workspaces

Export saves a versioned JSON workspace. Import accepts a trusted workspace document like [Estuary relay](examples/relay.json) or [Reading room](examples/reading.json). The confirmation dialog identifies the file as executable. Import replaces the workspace and invalidates old jobs. Close the Copilot session to discard unsaved content. Exported documents contain the compositions and their source, and omit conversation, camera history, credentials and runtime identifiers.

## Authoring and implementation

- [Canonical authoring skill](skills/contextarium/SKILL.md)
- [Prototype architecture](../docs/REDESIGN-PROTOTYPE.md)
- [Implementation report](../docs/REDESIGN-IMPLEMENTATION.md)
