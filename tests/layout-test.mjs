import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { makeActions } from "../connect/actions.mjs";
import { layoutContract } from "../core/layout-contract.mjs";
import { startCanvas } from "../connect/server.mjs";

const original = JSON.parse(await readFile(new URL("fixtures/lumen-harbor-original.json", import.meta.url), "utf8"));
const viewport = { width: 520, height: 980 };
const find = (sample, type, id, related) => sample.findings.find(f =>
  f.type === type && f.objectId === id && (!related || f.relatedObjectId === related));
const errors = sample => sample.findings.filter(f => f.severity === "error");
const scene = (objects, initial = "overview") => ({
  version: 1, title: "Synthetic layout cases", objects, behaviours: [], sources: {}, camera: { initial }
});
const card = (id, x, y, extra = {}) => ({
  id, x, y, w: 500, h: 280, type: "text", props: { title: id }, ...extra
});
const token = state => ({ expectedRevision: state.revision, expectedEpoch: state.bridgeEpoch });

async function connect(browser, canvas) {
  const failure = new Promise((_, reject) => {
    browser.once("error", reject);
    browser.once("exit", code => reject(new Error("Chromium exited before connecting: " + code)));
  });
  const ready = (async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (canvas.broker.connected()) return;
      await delay(200, undefined, { ref: false });
    }
    throw Error("Chromium did not connect to the loopback Canvas");
  })();
  await Promise.race([ready, failure]);
}

test("Canvas layout contract in a real Chromium renderer", { timeout: 45000 }, async t => {
  const defaultBrowser = process.platform === "win32"
    ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : "chromium";
  const profile = await mkdtemp(join(process.env.CONTEXTARIUM_TEST_TEMP || tmpdir(), "ctx-layout-"));
  const canvas = await startCanvas({ allowPrompts: false });
  const browser = spawn(process.env.CONTEXTARIUM_BROWSER || defaultBrowser, [
    "--headless", "--no-first-run", "--disable-crashpad-for-testing", "--window-size=900,950",
    "--user-data-dir=" + profile, canvas.url
  ], { windowsHide: true, stdio: "ignore" });
  t.after(async () => {
    if (browser.pid && browser.exitCode === null && browser.signalCode === null) {
      const exited = once(browser, "exit");
      browser.kill();
      await exited;
    }
    await canvas.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  });
  await connect(browser, canvas);

  const actions = makeActions(() => canvas);
  const invoke = (name, input = {}) => actions.find(a => a.name === name).handler({ instanceId: "test", input });
  const inspect = () => invoke("inspect_workspace");
  const load = scene => invoke("load_scene", { scene });
  const sample = async (samples = [viewport]) => {
    const state = await inspect();
    const result = await invoke("validate_layout", { ...token(state), samples });
    assert.equal(result.revision, state.revision);
    assert.equal(result.bridgeEpoch, state.bridgeEpoch);
    return result.samples;
  };

  await t.test("Original Lumen Harbor clips metric content and covers its heading", async () => {
    const live = await inspect();
    const samples = [{ ...viewport, focus: "zoom-target", minTextPx: 0 }];
    await assert.rejects(invoke("validate_layout", { ...token(live), candidateScene: original }), /requires viewport samples/);
    const candidate = await invoke("validate_layout", { ...token(live), candidateScene: original, samples });
    assert.equal(candidate.source, "candidate");
    assert.ok(find(candidate.samples[0], "heading_obstructed", "api-latency", "zoom-target"));
    assert.deepEqual(await inspect(), live, "Candidate preview changed the live scene");
    await load(original);
    // Wait for the recorded scene's initial camera-enter note mutation before taking a snapshot.
    for (let i = 0; i < 20 && (await inspect()).revision === 0; i++) await delay(50);
    const [bad] = await sample(samples);
    const overflow = find(bad, "content_overflow", "api-latency");
    const obstructed = find(bad, "heading_obstructed", "api-latency", "zoom-target");
    assert.ok(overflow?.measurements.occupiedBounds.h > 130, JSON.stringify(bad.findings));
    assert.ok(obstructed?.measurements.minimumBoardLocalY > 120, JSON.stringify(bad.findings));
    assert.ok(find(bad, "below_component_minimum", "api-latency"));
    assert.equal(bad.viewport.width, 520);
    t.diagnostic(`Original metric: authored height 130, measured occupied height ${overflow.measurements.occupiedBounds.h}, heading clear below y=${obstructed.measurements.minimumBoardLocalY}`);
  });

  await t.test("Mock agent corrects the original scene using diagnostics and Canvas actions", async () => {
    const before = await inspect();
    const [bad] = await sample();
    assert.deepEqual(await inspect(), before, "Measurement changed the live scene or camera");
    const metrics = before.scene.objects.filter(n => n.parent === "zoom-target" && n.type === "metric");
    const headingDepth = Math.max(...bad.findings.filter(f => f.relatedObjectId === "zoom-target")
      .map(f => f.measurements.minimumBoardLocalY || 0));
    const firstY = Math.max(260, Math.ceil(headingDepth) + 48);
    const [metricMinW, metricMinH] = layoutContract.components.metric.minimum;
    const w = Math.max(metricMinW, 480), h = Math.max(metricMinH, 260);
    const boardWidth = Math.max(layoutContract.components.board.minimum[0], w + 80);
    const commands = [{ command: "object.resize", target: "zoom-target", w: boardWidth, h: 1500 }];
    for (const [index, metric] of metrics.entries()) {
      assert.ok(find(bad, "content_overflow", metric.id), "Missing sizing evidence for " + metric.id);
      commands.push(
        { command: "object.resize", target: metric.id, w, h },
        { command: "object.move", target: metric.id, x: 40, y: firstY + index * (h + 16) }
      );
    }
    commands.push(
      { command: "object.resize", target: "test-note", w, h: 184 },
      { command: "object.move", target: "test-note", x: 40, y: firstY + metrics.length * (h + 16) }
    );
    for (const target of ["findings-list", "remediation-list"]) {
      const heading = bad.findings.find(f => f.objectId === target &&
        ["heading_obstructed", "heading_zone_intrusion"].includes(f.type));
      assert.ok(heading, "Missing board heading feedback for " + target);
      commands.push({ command: "object.move", target, x: 70, y: Math.ceil(heading.measurements.minimumBoardLocalY) + 16 });
    }
    const update = await invoke("apply_commands", { ...token(before), commands });
    assert.equal(update.revision, before.revision + 1);
    await assert.rejects(invoke("validate_layout", token(before)), /stale workspace/);
    const [resized] = await sample();
    const deeperHeading = Math.max(firstY, ...resized.findings.filter(f => f.relatedObjectId === "zoom-target")
      .map(f => Math.ceil(f.measurements.minimumBoardLocalY || 0) + 16));
    assert.ok(deeperHeading > firstY, "Resized board should expose its newly wrapped heading");
    const afterResize = await inspect();
    const noteY = deeperHeading + metrics.length * (h + 16);
    await invoke("apply_commands", { ...token(afterResize), commands: [
      ...metrics.map((metric, i) => ({command: "object.move", target: metric.id, x: 40, y: deeperHeading + i * (h + 16)})),
      { command: "object.move", target: "test-note", x: 40, y: noteY },
      { command: "object.resize", target: "zoom-target", w: boardWidth, h: noteY + 212 }
    ] });

    const [overview, detail, wide] = await sample([
      { ...viewport, focus: "zoom-target", minTextPx: 10 },
      { width: 440, height: 650, focus: "api-latency" },
      { width: 1000, height: 720, focus: "findings-board", minTextPx: 0 }
    ]);
    assert.deepEqual([overview, detail, wide].flatMap(errors), []);
    assert.ok(!find(overview, "text_below_readable_size", "zoom-target"), JSON.stringify(overview.findings));
    for (const metric of metrics) assert.ok(!find(overview, "text_below_readable_size", metric.id), JSON.stringify(overview.findings));
    assert.ok(!find(detail, "text_below_readable_size", "api-latency"), JSON.stringify(detail.findings));
    assert.equal(detail.viewport.width, 440);
    assert.equal(wide.viewport.width, 1000);
    t.diagnostic("Corrected composition: zero errors in narrow overview, narrow metric focus and wide findings samples");
  });

  await t.test("Nested containment, sibling overlap, child escape, and visibility", async () => {
    await load(scene([
      card("board", 0, 0, { type: "board", w: 1400, h: 1000 }),
      card("nested", 40, 300, { type: "board", parent: "board", w: 760, h: 640 }),
      card("inside", 60, 230, { parent: "nested" }),
      card("sibling", 110, 410, { parent: "nested" }),
      card("escaping", 1180, 260, { parent: "board" }),
      card("hidden", 60, 230, { parent: "nested", hidden: true }),
      card("edge-touch", 610, 410, { parent: "nested", w: 140 })
    ]));
    const [result] = await sample();
    assert.ok(find(result, "object_overlap", "sibling", "inside"), JSON.stringify(result.findings));
    assert.ok(find(result, "child_outside_board", "escaping", "board"));
    assert.ok(!result.findings.some(f => f.objectId === "hidden" || f.relatedObjectId === "hidden"));
    assert.ok(!result.findings.some(f => f.type === "object_overlap" &&
      [f.objectId, f.relatedObjectId].includes("nested")));
    assert.ok(!find(result, "object_overlap", "edge-touch", "sibling"));
    const live = await invoke("validate_layout", token(await inspect()));
    assert.ok(find(live.samples[0], "object_overlap", "sibling", "inside"));
  });

  await t.test("Semantic variants, readability and intentional table scrolling", async () => {
    await load(scene([
      card("variant", 0, 0, { w: 380, h: 210, props: { title: "Short summary" }, variants: [
        { minZoom: 1.2, type: "text", props: { text: "A fictional diagnostic detail. ".repeat(22) } }
      ] }),
      card("table", 760, 0, { type: "table", w: 720, h: 420, props: {
        title: "Scrollable table", columns: ["Entry", "Status"],
        rows: Array.from({ length: 18 }, (_, i) => [String(i), "Synthetic"])
      } })
    ], "variant"));
    const [low, high, table] = await sample([
      { width: 440, height: 650, focus: "variant", zoom: 0.8, minTextPx: 12 },
      { width: 1000, height: 720, focus: "variant", zoom: 1.8, minTextPx: 0 },
      { width: 520, height: 650, focus: "table", minTextPx: 0 }
    ]);
    assert.ok(!find(low, "content_overflow", "variant"), JSON.stringify(low.findings));
    const text = find(low, "text_below_readable_size", "variant");
    assert.ok(text?.measurements.smallestPx < 12, JSON.stringify(low.findings));
    assert.equal(find(high, "content_overflow", "variant")?.variantMinZoom, 1.2, JSON.stringify(high.findings));
    assert.ok(!find(table, "content_overflow", "table"), JSON.stringify(table.findings));
  });
});
