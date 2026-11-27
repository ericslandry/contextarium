# Contextarium design guide

The provider supplies geometry and composition. Contextarium applies trusted component rendering and reports measurable layout issues.

- Use a clear hierarchy, explicit labels and cues that do not rely on color alone. Preserve the dark drafting-board aesthetic and restrained accents.
- Organize by concept. Prefer a short overview and meaningful detail at closer scales. Use semantic variants where the information should change as users explore.
- Set geometry explicitly and leave margins between unrelated objects. Board dimensions are flexible. Keep board children below the heading zone and verify title wrapping at the intended viewport.
- Use the trusted components and declared properties in the [scene contract](SCENE-CONTRACT.md). Refer to [component sizing](../core/layout-contract.mjs) for dimensions and content capacity, and review rendered findings as described in the [authoring guide](AUTHORING.md).
- Use camera flights to explain relationships. Respect reduced-motion preferences and human camera control. Content should remain useful after a camera veto.
- Keep content declarative and use readable text, labels, or values that fit each authored box.
