# Contextarium

Contextarium is a native GitHub Copilot Canvas plugin powered by a portable spatial rendering engine. An agent composes declarative workspaces. The browser renders and validates them, and the human retains camera control.

## Use in Copilot

Add `ericslandry/contextarium` in **Customize → Add extension → Manage marketplaces**, then install **contextarium**. Under **Customize → Installed → Canvas**, choose **Contextarium** from the plugin and start a new session. The Canvas can open without submitting a chat prompt. See the [installation and update guide](docs/COPILOT-PLUGIN.md).

## Run without Copilot

- Open [index.html](index.html) directly in a browser for the embedded demo. Use **Import JSON** to try [scene.json](scene.json). From the map, choose **Critical findings** to see semantic zoom and detail loading. Pan or zoom to take camera control. Reset returns to the embedded workspace.
- To exercise static HTTP loading, serve the repository root. For example, run `python -m http.server 8000`, open `http://localhost:8000/index.html`, enter `./scene-http.json` in the Scene URL field, and select **Load URL**.
- For the connected demo, run `node dev/demo.mjs` and open its loopback URL. Select an object and use **Ask provider about selection** to add a detail card. A timed update then exercises push. The provider is deterministic.

Double-click or press Enter on a focused object to focus the camera. **M** opens the map, **Escape** takes camera control, the arrow keys pan, and **+** and **−** zoom.

## Structure and verification

| Path | Responsibility |
|---|---|
| `index.html` and the adjacent JSON fixtures | Standalone browser entry point, live scene, camera and validated runtime API |
| `core/` | Host-neutral input contracts, component sizing and browser layout validation |
| `connect/` | Optional loopback transport and provider actions used by Copilot and the deterministic demo |
| `plugins/contextarium/extensions/contextarium/` | Native Copilot Canvas registration, lifecycle and queued prompts |
| `dev/`, `tests/` | Deterministic demo and regressions |

From the repository root with Node.js 22+:

```sh
node tests/smoke.mjs
node --test tests/transport.mjs tests/layout-test.mjs
```

The layout test uses headless Chromium, with Edge as the Windows default. Set `CONTEXTARIUM_BROWSER` to select an executable. Use `CONTEXTARIUM_TEST_TEMP` if your browser needs a different temporary directory.

- [Architecture](docs/Contextarium-Architecture.md)
- [Scene and browser contract](docs/SCENE-CONTRACT.md)
- [Authoring guidance](docs/AUTHORING.md)
- [Roadmap](docs/ROADMAP.md)
- [Validation history](docs/VALIDATION-HISTORY.md)

The visual and camera foundation derives from the supplied Spatial Explainer HTML. Verify the derivative’s license before redistribution. See the [provenance record](docs/Contextarium-Architecture.md#provenance).
