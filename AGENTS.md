# Fieldwork development instructions

Read docs/Fieldwork-Architecture.md before changing architecture. The root README describes the recovered implementation and its current contract, not all target capabilities.

- Preserve standalone index.html with embedded JSON, no third-party runtime dependencies, optional HTTP connectivity.
- Browser owns live workspace; external providers own composition and domain intelligence. No general-purpose editing by default.
- Treat provider messages as data, validate mutations before application, and never execute arbitrary supplied HTML or JavaScript.
- Human navigation overrides external camera requests. Keep camera authority separate from scene updates.
- Keep source provenance, accessibility, and test evidence explicit. Do not claim production security or complete push/choreography support.
- Use stable object IDs, versioned contracts, and separate style guidance from data.
- Do not redistribute or publish the reference-derived code until its license has been verified.

Run `node tests/smoke.mjs` before committing. For browser testing use the root README's local HTTP instructions. Add regression tests for each contract change.
