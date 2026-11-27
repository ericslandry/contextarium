# Contextarium for GitHub Copilot Canvas

Contextarium is a single-plugin marketplace. Its catalog is in `.github/plugin/marketplace.json` and its package manifest is the root `plugin.json`. The catalog installs the repository root as the package, including the canonical runtime and fixtures. The Copilot-specific manifest uses the legacy `extensions` path field, and the native entry point loads the existing Canvas experiment. The installed package resolves its assets relative to itself. It needs no source checkout, build step, or separate installer.

## Install in GitHub Copilot desktop

1. Open **Customize → Add extension → Manage marketplaces**. Builds with a marketplace picker can also expose marketplace settings next to the picker.
2. While the marketplace is on the packaging branch, add `ericslandry/contextarium#copilot-plugin`. Once the packaging is on the default branch, use `ericslandry/contextarium` to follow that branch.
3. Select the **contextarium** marketplace, find **contextarium**, and select **Install**.
4. Open **Customize → Installed**, find **Contextarium (experiment)** under **Canvas**, and choose the entry labelled **Plugin: contextarium:contextarium**. Select **New session**, then pick a repository or **No repository**. This opens the Canvas without a chat prompt. The `contextarium-experiment` Canvas exposes `authoring_guide`, `inspect_workspace`, `validate_layout`, and the scene actions.

The plugin row on **Customize → Installed** has an enable switch and an actions menu for **Update** and **Uninstall**. An existing session may retain its Canvas until you open a fresh session.

## Manage with Copilot CLI

```sh
copilot plugin marketplace add 'ericslandry/contextarium#copilot-plugin'
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

## Verified on desktop 1.5.0

- Copilot added the branch-qualified marketplace from the private, user-owned GitHub repository while signed in. Native installation listed the plugin, extension, and Canvas separately from the repository-scoped development Canvas.
- The remote install populated Copilot's installed-plugin cache with its own copy of the canonical runtime. The cache was a directory, and the runtime blob matched the repository's canonical HTML. The install ran without the experiment's prepared assets.
- The Canvas rendered and connected in two fresh local sessions, one with **No repository** and one using an unrelated empty Git repository. The unrelated session had no user messages. It opened before any repository trust approval.
- The native **Update** action upgraded version 0.1.0 to 0.1.1 from the private marketplace. The updated Canvas rendered in another fresh unrelated-repository session. Disabling the plugin disabled its Canvas launcher. Uninstall removed the installed package, and reinstall restored the plugin Canvas. The app can retain a disabled catalog row after uninstall.
- Local-path marketplace installs on CLI 1.0.115-7 use a live folder. Use the GitHub marketplace source when you want an installation independent of a checkout. No Copilot chat prompts were submitted.

## GitHub references

- [Customize the GitHub Copilot app](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app)
- [Create and share a plugin marketplace](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/create-and-share-plugin-marketplaces)
- [Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
