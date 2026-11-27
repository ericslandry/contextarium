# Contextarium

For GitHub Copilot Canvas, see [install and manage the Contextarium plugin](docs/COPILOT-PLUGIN.md).

**Give context a place.** A lightweight, declarative spatial workspace runtime for exploring dynamic information, independently or with an external agent.

Prototype derived from Spatial Explainer.

## Run

Open `index.html` in a browser for the embedded demonstration. No libraries, build process, fonts, audio, or backend are required. Use Import JSON to load `scene.json`. To exercise actual HTTP fetching, serve this directory using any static HTTP server, e.g. `python -m http.server 8000`, open `http://localhost:8000/index.html`, enter `./scene-http.json` in the Scene URL box, and press Load URL. Its two detail sources fetch the provided JSON files. A backend can return the same command arrays instead of serving those files.

## Demonstration

1. From the map, click the Critical findings title (rather than the button). The original cinematic flight focuses the object. Semantic zoom adds detail and the settled camera event loads a new board, changes the metric, moves the notes and registers a new behaviour.
2. Click Load details to navigate to the new board, while Follow is on. Its Return to overview button uses the newly registered behaviour.
3. Pan or wheel zoom to take control. Follow switches off. Content updates remain permitted; automatic camera commands are suppressed until Follow is explicitly enabled. A human-requested flight also cannot be preempted by automatic navigation.
4. On the Service health board, click Refresh sample to change the chart. Reset restores the embedded demo.

Double-click an object (or tab to it and press Enter) to focus it. M opens the map; Escape cancels automatic navigation; arrow keys pan, +/− zoom. Map fitting accounts for current visible objects. Native HTML controls remain interactive. Touch drag is available; multi-touch pinch has not been implemented.

## Provenance

This implementation is a separate derivative of the supplied `How This Explainer Works — Spatial Presentation PoC` HTML, not a continuation of the earlier Fieldwork runtime. It directly retains the reference's `ease`, `lerpCam` (including geometric scale interpolation and pull-back arc), `drawBg`, canvas sizing and parallax dust, CSS palette, sheet marks and board styling. The base camera fit and screen/world conversion were adapted. The background grid is aligned with the world center. No `will-change: transform` or `translate3d` is used. The reference itself is not changed. Its Google Fonts links, fixed rings/board sequence, audio, timeline, captions and cue index were removed. The reference's styling vocabulary is retained but full SVG cue choreography and path pulses are not exposed as declarative commands in this prototype. Source licensing was not supplied; verify rights before redistributing the derivative.

## Contract v1 (new derivative; not compatible with old Fieldwork v2)

The scene envelope consists of `version: 1`, `title`, `objects`, `behaviours`, `sources`, and `camera: {initial: "overview"}` (or initial object ID). See `scene.json` for a complete example. Unknown fields and invalid values are rejected.

Each object has `id`, `type`, `x`, `y`, `w`, `h`, `props`; optional `parent`, `hidden`, and `variants`. A root object's x/y is its world-space top-left in CSS design units. A child of a board uses board-local offsets; its absolute coordinates are calculated recursively. Children are logically grouped but rendered as separate DOM siblings. Moving a board moves descendants; deleting it deletes descendants. A board can itself be a child of another board. Board dimensions are arbitrary (1600×900 is only the demo convention).

Trusted component types: `board`, `text`, `metric`, `list`, `chart`, `table`, `controls`. Shared props: `label`, `title`, `text`, `value`, `items`, `columns`, `rows`, `buttons`. Chart items use `{label,value}` with nonnegative numeric values; list items may be strings. A button uses `{label,event}`. Text is inserted with `textContent`; arbitrary HTML/JS is not accepted. A semantic variant is `{minZoom,type,props}`; ordered by increasing threshold, the highest matching variant overlays base props and may replace the component type (except board). Zoom `s` is relative to the reference 1600×900 viewport fit, not absolute CSS scale.

### Commands

| Command | Fields (in addition to `command`) |
|---|---|
| object.upsert | object (complete definition) |
| object.update | target, props (shallow merge of base properties) |
| object.move | target, x, y, optional parent (null detaches) |
| object.resize | target, w, h |
| object.delete | target |
| object.visibility | target, hidden |
| behaviour.upsert | behaviour |
| behaviour.delete | target |
| camera.focus | target, optional durationMs |
| camera.overview | optional durationMs |
| camera.set | x, y, s, optional durationMs |
| data.fetch | source |

`contextarium.getState()` returns a snapshot. `contextarium.loadScene(scene)` validates and replaces the scene. `await contextarium.dispatch(command)` handles an individual command or data fetch. `contextarium.batch(commands)` validates all mutations on a cloned scene before committing, then requests camera actions. Camera requests are independently subject to human veto; an accepted scene mutation does not guarantee camera movement. Fetch commands are not permitted directly in mutation batches; registered behaviours may request a registered source. `contextarium.events` is an EventTarget; notifications include `scene.ready`, `scene.changed`, `widget.action`, `camera.enter`, `camera.leave`, `camera.arrived` (animated arrival), `camera.interrupted` (suppressed request), `data.loaded`. This is an in-browser JS interface, not a remotely exposed API or authentication boundary. `window.contextarium` is the canonical API; `window.fieldwork` remains a compatibility alias to the same object. The JSON v1 contract is unchanged.

### Behaviours and sources

A rule is `{id,on:{event,target?,name?,minZoom?},once?,actions:[...]}`. Accepted trigger events are `widget.action`, `camera.enter`, `camera.leave`, `scene.ready`, `data.loaded`. Camera enter/leave rules require a target and evaluate whether its center is visible and threshold met, after camera movement settles. `widget.action` matches an object ID and button event name, or `select` from clicking a non-map object. `data.loaded` uses the source name. Once-rules reset when a scene is loaded or when their definition changes. Concurrent duplicate rules and source requests are deduplicated. Behaviours run ordered actions, not an atomic transaction. The JSON response mutation batch itself is validated atomically. New rules can refer to existing registered sources; responses cannot introduce arbitrary URLs via a command. The initial scene specifies named `inline` sources (`commands` array) or `http` sources (`url` same-origin HTTP/S). HTTP redirects are rejected and scene replacement cancels outstanding source requests. Content requests may still update the scene after a human camera takeover; stale camera requests are rejected.

## Validation and known limits

Chromium tests using direct page-content loading passed: animated human camera flight; automated flight veto; semantic variant display; zoom-triggered discovery; content, layout, object and behaviour mutations; click-driven navigation; recursive deletion; atomic invalid batch rejection; manual wheel veto; resuming Follow. No browser script errors were observed. This environment blocked direct file and localhost navigation, so actual HTTP/file opening remains to be verified locally. No actual backend or external agent is included. Only pull-based HTTP and the local command interface are implemented, not server-push transport. The included data is illustrative and repeated refreshes return the same sample. Schema checks and CSP provide prototype guardrails, not production-grade authentication/authorization, loop prevention or resource limits. Keyboard navigation and reduced motion are supported at a basic level; screen reader, mobile, multi-touch, high-volume performance and cross-browser testing remain pending. Layout is explicit, not automatic; diagrams/connectors and declarative reveal choreography can be added later as trusted components/actions.
