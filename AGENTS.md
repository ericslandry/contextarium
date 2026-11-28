# Contextarium development instructions

Use the [redesign](docs/REDESIGN.md) and [current architecture](docs/REDESIGN-PROTOTYPE.md) when changing product boundaries. Contextarium is a native GitHub Copilot Canvas plugin.

- Preserve stable composition IDs, human camera precedence, and the marketplace, plugin, extension and Canvas identities.
- Keep the session workspace authority and browser presentation state separate. Reject stale work and publish coherent revisions.
- Allow trusted HTML, CSS, SVG and JavaScript as described by the redesign. Preserve Copilot permission enforcement. The renderer does not dispatch native operations.
- Keep the [authoring skill](prototype/skills/contextarium/SKILL.md) the shared source of agent authoring instructions.
- Keep the legacy `index.html` browser viewer available for older scenes. Preserve provenance and historical validation evidence.
- Run `node --test prototype/tests/*.test.mjs` before committing. If changing legacy code, also run `node tests/smoke.mjs` and `node --test tests/transport.mjs tests/layout-test.mjs`.
- Use deterministic providers for routine checks. Submit live Copilot chat prompts only with the user's explicit approval.
