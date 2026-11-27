# Contextarium authoring guide

Read the runtime contract and design guide returned by authoring_guide. Inspect the live workspace before every batch. The browser is authoritative; the provider does not maintain a synchronized scene. Use the returned revision and bridgeEpoch as expectedRevision and expectedEpoch. Reinspect after rejection or timeout; do not blindly retry. A successful mutation is not a guarantee that camera motion occurred or finished. Inspect follow and cameraVetoes; recent_events includes arrival and interruption.

Use trusted types board, text, metric, list, chart, table and controls. Explicitly specify world coordinates and dimensions; nested child coordinates are relative to their board. Keep stable IDs, avoid overlap, use concise titles, whitespace and hierarchy, and provide information at multiple scales using semantic variants. No arbitrary code, HTML or CSS. Avoid unsolicited camera changes while the user is exploring.

## Size and validate before presenting a scene

`authoring_guide` returns the versioned `layoutContract` with minimum and recommended dimensions, content capacity, padding and typography ranges. Start with recommended sizes, and budget for wrapping and every semantic variant. For example, a metric starts at 320 × 220 world units and 480 × 300 is recommended for a short label, title and value. Put explanation in a separate text card. The connected renderer fits padding and typography within fixed limits. It keeps the authored position and size, so oversized content still needs a composition change.

Reserve at least the top 200 world units of each board for its heading. The measured zone can be deeper when labels, headings or descriptions wrap. Put children below the depth reported as `minimumBoardLocalY` and keep them within the board. Parent containment is intentional. Intersections between unrelated rendered objects are reported as overlaps.

For a new composition, pass `candidateScene` together with samples to `validate_layout` before publishing. After loading a scene or applying commands, inspect the workspace and call `validate_layout` with the same revision and epoch. With no samples the action checks the live DOM for structural defects. For readability, request representative viewports, focus targets and scales. The preview uses the same renderer and fitting rules without moving the live camera or executing behaviours and data sources. Sample both sides of each important semantic threshold. Set `minTextPx: 0` on a map sample where tiny labels are intentional. A focused sample defaults to a 12 CSS-pixel text-size check.

```json
{
  "expectedRevision": 1,
  "expectedEpoch": "replace-with-live-bridgeEpoch",
  "samples": [
    {"width": 480, "height": 820, "focus": "agent-summary"},
    {"width": 1000, "height": 750, "focus": "agent-details", "zoom": 1.4}
  ]
}
```

Findings carry severity, object IDs, component and active variant, measured bounds or font size, and a suggested correction. For `content_overflow`, compare `occupiedBounds` with `bounds` and resize, shorten or split the content. For `heading_obstructed` or `heading_zone_intrusion`, move the child below `minimumBoardLocalY`. Resolve `object_overlap` by moving or resizing a covering object. Use `apply_commands` and revalidate until the relevant samples have no layout errors and readability warnings are understood. If `omittedFindings` is nonzero, repair the reported findings and rerun. Advisory diagnostics can describe an already-committed scene, so run the check before telling the user the scene is ready.

Example apply_commands input (replace revision/epoch with actual values):
```json
{
 "expectedRevision": 0,
 "expectedEpoch": "replace-with-live-bridgeEpoch",
 "commands": [
   {"command":"object.upsert","object":{"id":"agent-summary","type":"board","x":1900,"y":-550,"w":1600,"h":900,"props":{"label":"AGENT / ANALYSIS","title":"Investigation summary","text":"Overview of the available evidence."}}},
   {"command":"object.upsert","object":{"id":"agent-details","type":"text","parent":"agent-summary","x":80,"y":290,"w":1440,"h":475,"props":{"title":"Next steps","text":"Review the supporting findings.","buttons":[{"label":"Ask Copilot","event":"ask-copilot"}]}}}
 ]
}
```

The browser records camera events. The explicit request button uses the host provider callback. Authored ask-copilot button events request work in Copilot, and ask-provider requests work in the deterministic demo. The manual-zoom heuristic is optional and disabled by default. It consumes a recent trusted wheel or zoom-key gesture when a declared camera.enter fires while Follow is off. The server rate-limits provider requests.

Try asking Copilot to build a three-board fictional service health investigation with an overview, findings, and remediation priorities. Use synthetic data only. Ask it to add new findings proactively while you pan; it should use apply_commands without camera.focus unless asked. Verify the original page remains usable in standalone mode.
