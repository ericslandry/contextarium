# Contextarium design guide (initial draft)

This is proposed provider guidance, not a ratified theme specification. The runtime remains responsible for rendering and mechanics; the provider supplies geometry and composition.

- Preserve the dark drafting-board aesthetic, restrained accent colors, clear labels and readable hierarchy. Do not encode meaning by color alone.
- Organize by concepts, not arbitrary decoration. Prefer a short summary at overview scale and meaningful additional detail at closer scales.
- Explicitly set geometry. Leave sufficient margins and avoid overlapping unrelated objects. Boards are optional; their dimensions are not fixed.
- Use the existing trusted components: board, text, metric, list, chart, table and controls. The root README describes their accepted properties and behaviors.
- Camera flights should explain relationships; avoid unnecessary motion. Respect reduced-motion preferences and human camera control.
- Data must remain declarative. Do not supply arbitrary HTML, JavaScript or styles.

Future work: formal token definitions, examples, component sizing rules, accessibility criteria and rendered-composition validation.
