# Contextarium development instructions

Read [the architecture](docs/Contextarium-Architecture.md) before changing a boundary. Contextarium is a native Copilot Canvas plugin with a portable browser core.

- Keep `index.html` directly openable with embedded JSON. Keep the core free of the Copilot SDK, network requirements, and build-time dependencies.
- Use the canonical runtime and fixtures from the package root. Keep reusable input schemas, sizing rules, and layout validation in `core/`; keep provider transport in `connect/`; keep Copilot SDK calls and prompt policy in the native extension.
- The browser owns live workspace state and validates all mutations. Providers own composition and domain decisions. Preserve human camera precedence and avoid general-purpose editing.
- Treat provider messages and fetched data as data. Accept declared types and commands, and keep arbitrary HTML, JavaScript, and privileged external actions outside the scene.
- Preserve stable object IDs, the v1 scene contract, the `contextarium` plugin and marketplace names, and the `contextarium-experiment` Canvas ID.
- Use native marketplace installation, updates and uninstall. Keep synthetic test providers and fixtures separate from the production extension. Preserve accessibility, provenance and observed validation evidence. Verify source licensing before redistribution.

From the root, run `node tests/smoke.mjs` and `node --test tests/transport.mjs tests/layout-test.mjs` before committing. Add regression coverage when changing a contract. Use native controls or deterministic providers for validation and submit Copilot chat prompts only with the user's explicit approval.
