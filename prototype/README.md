
# Contextarium runtime and demos

Contextarium is a living spatial workspace for one Copilot session. Start with the estuary relay diagram and its interactive buffer simulation. Ask Copilot to visualize a topic and it can dispatch a background composition that updates the same workspace. The reading room example uses an editorial layout with selectable prose.

## Run the deterministic demo

Use Node 24 or later.

~~~sh
node prototype/runtime/demo.mjs
~~~

Open the printed loopback URL in Edge or Chromium. Select the two scenes from the demo menu and use **Run demo update** to feed a synthetic completed conversation into the same observer, coordinator, authority and renderer used in the plugin. The demo does not connect to Copilot.

Use the **Focus…** picker or double-click a composition to fly to it. Wheel zooms towards the pointer. Drag the canvas to pan. Turn on **Select text** to highlight content, and hold Space or use the middle mouse button to pan in that mode. On a focused workspace, arrow keys pan and plus/minus zoom. Touch supports pan and pinch. **Back**, **Forward**, **Overview** and breadcrumbs navigate viewpoints. Manual navigation turns **Follow** off. Re-enable it explicitly to accept guidance again.

## Install in GitHub Copilot Desktop

Use the [Contextarium installation and update guide](../docs/COPILOT-PLUGIN.md).

## Open and save workspaces

Export saves a versioned JSON workspace. Import accepts a trusted workspace document like [Estuary relay](examples/relay.json) or [Reading room](examples/reading.json). The confirmation dialog identifies the file as executable. Import replaces the workspace and invalidates old jobs. Close the Copilot session to discard unsaved content. Exported documents contain the compositions and their source, and omit conversation, camera history, credentials and runtime identifiers.

## Composition theme

Compositions inherit the Spatial Explainer palette and use Bricolage Grotesque for headings, IBM Plex Sans for body text and IBM Plex Mono for code. Their own CSS and inline styles can override the defaults. Use `--ct-paper`, `--ct-muted`, `--ct-ink`, `--ct-line`, `--ct-signal` and `--ct-sense` to match the canvas when useful. Composition authors choose the backgrounds and layouts.

The canvas grid, parallax and flight arc derive from the [legacy viewer](../index.html). The font files are self-hosted Latin subsets from Google Fonts and use system fallback for other glyphs. See the [Bricolage Grotesque](runtime/fonts/OFL-Bricolage-Grotesque.txt), [IBM Plex Sans](runtime/fonts/OFL-IBM-Plex-Sans.txt) and [IBM Plex Mono](runtime/fonts/OFL-IBM-Plex-Mono.txt) licenses.

## Capture a visual review

Run `node prototype/tests/visual-review.mjs test-results/spatial-review/after` to capture the empty canvas, built-in compositions and camera flight in Edge. Pass a checkout path as the final argument to capture a baseline with the same fixture files and actions. Use `CONTEXTARIUM_BROWSER` to select a different Chromium binary.

## Authoring and implementation

- [Canonical authoring skill](skills/contextarium/SKILL.md)
- [Prototype architecture](../docs/REDESIGN-PROTOTYPE.md)
- [Implementation report](../docs/REDESIGN-IMPLEMENTATION.md)
