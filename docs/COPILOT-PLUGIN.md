# Contextarium for GitHub Copilot Canvas

Contextarium 0.5.0 upgrades the existing `contextarium@contextarium` plugin. The package uses the existing extension directory and `contextarium-experiment` Canvas ID. It includes the spatial runtime and bundled skills. Copilot loads them from the installed package without a separate checkout or build.

## Install or update in Copilot Desktop

1. In **Customize → Add → Manage marketplaces**, add `ericslandry/contextarium`. If the **contextarium** marketplace is already registered, use **Refresh catalog**. The historical `copilot-plugin` source branch is also a release channel.
2. Install **contextarium** from the marketplace, or use **Update** on the installed plugin.
3. In **Customize → Installed → Canvas**, choose **Contextarium**, labelled **Plugin: contextarium:contextarium**. Open a fresh session with **New session → No repository**. Existing sessions can still have their prior Canvas open.
4. The canvas starts empty and automatic composition starts paused. Ask Copilot to visualize something from the conversation or to enable automatic composition. These actions can use Copilot model requests.

The separate `contextarium-redesign` preview can be uninstalled when you have finished with its sessions. Export any work you want to preserve before closing an active session. Its workspace exports are compatible with 0.3.1.

## Share feedback

Use `/contextarium:feedback <details>` in the Copilot app to draft a bug report or improvement in chat. Use `/contextarium:feedback file <details>` when you want Copilot to file the issue in the Contextarium repository.

## Composition failures

The canvas activity indicator shows the error or termination reason Copilot returns. The existing workspace is preserved, and a later composition request can proceed. The native `inspect_workspace` action reports the most recent attempt and the most recent failure for this session. Copilot's Dynamic Workflow details also show run time and usage when available. See the [0.4.1 reliability notes](WORKFLOW-RELIABILITY.md).

## Workspace compatibility and rollback

Open older declarative scene exports with the [0.2.0 browser viewer](https://github.com/ericslandry/contextarium/tree/release/contextarium-0.2.0). Exported redesign workspaces use a different document format and have no automatic converter. Keep the original files when moving between versions. The import confirmation identifies executable workspaces.

The [0.2.0 rollback source](https://github.com/ericslandry/contextarium/tree/release/contextarium-0.2.0) retains the old plugin and scene reader. If replacing your marketplace registration to use that source, Copilot Desktop may require uninstalling its currently installed plugin first. Export active workspaces before replacing a registration.

## Manage with Copilot CLI

```sh
copilot plugin marketplace add ericslandry/contextarium
copilot plugin marketplace update contextarium
copilot plugin install contextarium@contextarium
copilot plugin update contextarium@contextarium
```

The extension targets Copilot Desktop with native Canvas and Dynamic Workflows. See the [implementation report](REDESIGN-IMPLEMENTATION.md) for verified host behavior and limitations.
