# Contextarium

Contextarium is a living spatial workspace for a GitHub Copilot session. Copilot can develop visual compositions alongside the conversation, and you control camera navigation.

## Use in Copilot

Add `ericslandry/contextarium` in **Customize → Add → Manage marketplaces**, then install **contextarium**. Existing installs can use **Update**. Open **Customize → Installed → Canvas → Contextarium** and start a fresh session. Automatic composition starts paused. See the [installation and update guide](docs/COPILOT-PLUGIN.md).

## Run without Copilot

Run `node prototype/runtime/demo.mjs` with Node.js 24 or later, then open the printed URL in Edge or Chromium. The two demo scenes and the synthetic conversation update require no Copilot usage. See [demo and navigation controls](prototype/README.md).

## Workspace compatibility

Open older declarative scene exports with the [0.2.0 browser viewer](https://github.com/ericslandry/contextarium/tree/release/contextarium-0.2.0). Exported redesign workspaces use a different document format and have no automatic converter. The legacy [standalone viewer](index.html) is also retained in this checkout.

## Development

Run `node --test prototype/tests/*.test.mjs` from the repository root. Set `CONTEXTARIUM_BROWSER` if Edge is unavailable at its default Windows path.

- [Current architecture](docs/REDESIGN-PROTOTYPE.md)
- [Authoring guide](prototype/skills/contextarium/SKILL.md)
- [Implementation and validation report](docs/REDESIGN-IMPLEMENTATION.md)
- [Legacy architecture and provenance](docs/Contextarium-Architecture.md)
