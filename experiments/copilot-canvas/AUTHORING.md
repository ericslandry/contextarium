# Fieldwork Canvas authoring contract (experimental)

Read the runtime contract and design guide returned by authoring_guide. Inspect the live workspace before every batch. The browser is authoritative; the provider does not maintain a synchronized scene. Use the returned revision and bridgeEpoch as expectedRevision and expectedEpoch. Reinspect after rejection or timeout; do not blindly retry. A successful mutation is not a guarantee that camera motion occurred or finished. Inspect follow and cameraVetoes; recent_events includes arrival and interruption.

Use trusted types board, text, metric, list, chart, table and controls. Explicitly specify world coordinates and dimensions; nested child coordinates are relative to their board. Keep stable IDs, avoid overlap, use concise titles, whitespace and hierarchy, and provide information at multiple scales using semantic variants. No arbitrary code, HTML or CSS. Avoid unsolicited camera changes while the user is exploring.

Example apply_commands input (replace revision/epoch with actual values):
```json
{
 "expectedRevision": 0,
 "expectedEpoch": 0,
 "commands": [
   {"command":"object.upsert","object":{"id":"agent-summary","type":"board","x":1900,"y":-550,"w":1600,"h":900,"props":{"label":"AGENT / ANALYSIS","title":"Investigation summary","text":"Overview of the available evidence."}}},
   {"command":"object.upsert","object":{"id":"agent-details","type":"text","parent":"agent-summary","x":80,"y":290,"w":1440,"h":475,"props":{"title":"Next steps","text":"Review the supporting findings.","buttons":[{"label":"Ask Copilot","event":"ask-copilot"}]}}}
 ]
}
```

The browser records camera events but deliberately does not automatically invoke reasoning on zoom: programmatic motion can cause the same events as human motion. Use the explicit Ask Copilot button or declare a button event named ask-copilot; it submits a bounded prompt. A later opt-in policy may use human-attributed zoom events with debouncing and loop prevention. There is no model API key, agent framework dependency or generic external tool execution in the browser.

Try asking Copilot to build a three-board fictional service health investigation with an overview, findings, and remediation priorities. Use synthetic data only. Ask it to add new findings proactively while you pan; it should use apply_commands without camera.focus unless asked. Verify the original page remains usable in standalone mode.
