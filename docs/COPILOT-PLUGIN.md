# Contextarium for GitHub Copilot Canvas

Contextarium is a single-plugin marketplace. Its catalog is in `.github/plugin/marketplace.json` and its package manifest is the root `plugin.json`. The catalog installs the repository root as the package, including the canonical runtime and fixtures. The Copilot-specific manifest uses the legacy `extensions` path field, and the native entry point loads the existing Canvas experiment. The installed package resolves its assets relative to itself. It needs no source checkout, build step, or separate installer.

## Install in GitHub Copilot desktop

1. Open **Customize**, then open the marketplace settings next to the marketplace picker.
2. Add `ericslandry/contextarium` as a marketplace source. To test a release branch before it reaches the default branch, use `ericslandry/contextarium#copilot-plugin` in a client that supports a ref on marketplace sources.
3. Select the **contextarium** marketplace, find **contextarium**, and select **Install**.
4. Start a fresh **This computer** session. The installed extension contributes the `contextarium-experiment` Canvas and exposes `authoring_guide`, `inspect_workspace`, `validate_layout`, and the scene actions. Use the Canvas controls or ask Copilot to open the Canvas when you want to use it.

The app’s **Customize → Installed** page can toggle the plugin. Use the native CLI commands below for lifecycle controls that your app build does not expose.

## Manage with Copilot CLI

```sh
copilot plugin marketplace add ericslandry/contextarium
copilot plugin marketplace browse contextarium
copilot plugin install contextarium@contextarium
copilot plugin list
copilot plugin marketplace update contextarium
copilot plugin update contextarium@contextarium
copilot plugin disable contextarium@contextarium
copilot plugin enable contextarium@contextarium
copilot plugin uninstall contextarium@contextarium
copilot plugin marketplace remove contextarium
```

Use a fresh session when checking changes to discovery or enablement. If you previously used the experimental project or user extension, validate in an unrelated repository first. Both entry points expose the same Canvas ID.

## Private repositories and compatibility

GitHub documents authenticated private marketplace access. The installing user needs read access to the repository and must be signed in to GitHub in their Copilot client. Repository and organization policy can affect access and plugin enablement. Keep distribution within the authorized private repository while the runtime’s third-party provenance is being reviewed.

The package targets the local Copilot Canvas host. The manifest uses Copilot-specific executable extensions, so clients that support only portable Agent Plugins 1.0 components will not load this Canvas. The installed desktop host tested during development is GitHub Copilot 1.5.0 with CLI 1.0.115-7 and SDK protocol 4.

## GitHub references

- [Customize the GitHub Copilot app](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app)
- [Create and share a plugin marketplace](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/create-and-share-plugin-marketplaces)
- [Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
