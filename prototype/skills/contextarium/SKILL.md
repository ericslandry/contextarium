
---
name: contextarium
description: Develop a living spatial explanation in Contextarium through HTML, CSS, SVG and JavaScript.
---

# Author a Contextarium workspace

Develop what the user and Copilot are learning into a spatial explanation. Preserve useful landmarks and visual continuity. Use scale to move from orientation to the details that matter. A diagram, illustrated argument, working simulation or typographic reading room can each have its own visual language.

- Review the workspace, recent foreground turns, intent and presentation context. Prefer explicit requests. If a conversation turn does not materially change the workspace, return empty upsert and remove arrays and a null focus ID.
- The initial estuary relay is an illustrative workspace. Replace its compositions together when the conversation calls for a different subject. Source previews can be truncated. Avoid reconstructing truncated source if a new nearby composition or a contextual update would better preserve the existing work.
- Propose one coherent revision. Return an object with `upsert`, `remove` and `focusId`. Upsert complete compositions by stable ID. Use absolute world coordinates, positive local width, height and scale, opacity from 0 to 1, and a parent ID or null for conceptual breadcrumbs. The parent relationship is semantic. It does not transform the child's coordinates.
- Each composition has `id`, `title`, `x`, `y`, `width`, `height`, `scale`, `opacity`, `parent`, `html`, `css` and `js`. HTML can contain inline SVG. CSS is wrapped in a local `@scope` rule for layout hygiene. Use local class names and avoid document-wide selectors, global keyframes with common names, or global listeners where local ones suffice.
- JavaScript executes directly in the shared document. Put executable behavior in `js`, using the supplied `root` and `lifecycle`. Use `lifecycle.signal` for listeners, `lifecycle.onCleanup(fn)` for timers and animation cancellation, or return a synchronous cleanup function. Root markup remains mounted through geometry and opacity changes. Changing its source or removing the item triggers cleanup.
- Use native labeled buttons, inputs, and readable text. Space-drag or middle-drag is available for camera movement over content. Preserve ordinary controls, wheel and text selection where possible. Keep a narrow focused composition usable and respect reduced motion. Use focus guidance sparingly. Human navigation takes precedence.
- Size labels for focused viewing. Make overview landmarks distinct without relying on color alone. Use coherent progressive detail, optional breadcrumbs and meaningful motion. Do not fill every region with identical panels.
- Inspect before revising. Replace only changed compositions. The workspace validates identity, geometry, relationships and freshness before applying a candidate. Inspect the visible result for clipping and context, then refine it.
