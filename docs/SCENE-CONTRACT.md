# Scene and browser contract v1

The scene envelope consists of `version: 1`, `title`, `objects`, `behaviours`, `sources`, and `camera: {initial: "overview"}` (or initial object ID). See [scene.json](../scene.json) for a complete example. Unknown fields and invalid values are rejected.

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
