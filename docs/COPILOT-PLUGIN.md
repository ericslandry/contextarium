# Contextarium for GitHub Copilot Canvas

Contextarium 0.3.1 upgrades the existing `contextarium@contextarium` plugin. The package uses the existing extension directory and `contextarium-experiment` Canvas ID. Its package includes the spatial runtime, starter compositions and authoring skill. Copilot loads them from the installed package without a separate checkout or build.

## Install or update in Copilot Desktop

1. In **Customize → Add → Manage marketplaces**, add `ericslandry/contextarium`. If the **contextarium** marketplace is already registered, use **Refresh catalog**. The historical `copilot-plugin` source branch is also a release channel.
2. Install **contextarium** from the marketplace, or use **Update** on the installed plugin.
3. In **Customize → Installed → Canvas**, choose **Contextarium**, labelled **Plugin: contextarium:contextarium**. Open a fresh session with **New session → No repository**. Existing sessions can still have their prior Canvas open.
4. Automatic composition starts paused. Ask Copilot to use `request_visualization` to request a visual or `set_automatic_composition` to change automatic curation. These actions can use Copilot model requests.

The separate `contextarium-redesign` preview can be uninstalled when you have finished with its sessions. Export any work you want to preserve before closing an active session. Its workspace exports are compatible with 0.3.1.

## Workspace compatibility and rollback

Open older declarative scene exports with the [0.2.0 browser viewer](https://github.com/ericslandry/contextarium/tree/release/contextarium-0.2.0). Exported redesign workspaces use a different document format and have no automatic converter. Keep the original files when moving between versions. The 0.3.1 import confirmation identifies executable workspaces.

The [0.2.0 rollback source](https://github.com/ericslandry/contextarium/tree/release/contextarium-0.2.0) retains the old plugin and scene reader. If replacing your marketplace registration to use that source, Copilot Desktop may require uninstalling its currently installed plugin first. Export active workspaces before replacing a registration.

## Manage with Copilot CLI

```sh
copilot plugin marketplace add ericslandry/contextarium
copilot plugin marketplace update contextarium
copilot plugin install contextarium@contextarium
copilot plugin update contextarium@contextarium
```

The extension targets Copilot Desktop with native Canvas and Dynamic Workflows. See the [implementation report](REDESIGN-IMPLEMENTATION.md) for verified host behavior and limitations.
