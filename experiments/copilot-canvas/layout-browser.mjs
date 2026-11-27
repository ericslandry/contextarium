import { layoutContract } from "./layout-contract.mjs";

const EPSILON = 1;
const MAX_FINDINGS = 60;
const rounded = value => Math.round(value * 10) / 10;
const rect = (x, y, w, h) => ({ x, y, w, h });
const right = r => r.x + r.w;
const bottom = r => r.y + r.h;
const box = r => rect(r.left, r.top, r.width, r.height);
const scaleBox = (r, scale, origin = { x: 0, y: 0 }) =>
  rect((r.x - origin.x) / scale, (r.y - origin.y) / scale, r.w / scale, r.h / scale);
const reportBox = r => Object.fromEntries(Object.entries(r).map(([key, value]) => [key, rounded(value)]));

function intersection(a, b, tolerance = EPSILON) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const w = Math.min(right(a), right(b)) - x, h = Math.min(bottom(a), bottom(b)) - y;
  return w > tolerance && h > tolerance ? rect(x, y, w, h) : null;
}

function contains(outer, inner) {
  return inner.x >= outer.x - EPSILON && inner.y >= outer.y - EPSILON &&
    right(inner) <= right(outer) + EPSILON && bottom(inner) <= bottom(outer) + EPSILON;
}

function textRuns(content) {
  const doc = content.ownerDocument;
  const walker = doc.createTreeWalker(content, 4); // SHOW_TEXT
  const range = doc.createRange();
  const runs = [];
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (!text.textContent.trim()) continue;
    const element = text.parentElement;
    range.selectNodeContents(text);
    const boxes = [...range.getClientRects()].map(box).filter(r => r.w > 0 && r.h > 0);
    if (boxes.length) runs.push({
      boxes,
      field: element.closest(".node-label, .node-title, .node-text, .metric")?.className || element.localName,
      fontSize: parseFloat(doc.defaultView.getComputedStyle(element).fontSize),
      scroll: element.closest(".table-wrap")
    });
  }
  return runs;
}

function layoutSample(win, state, minTextPx) {
  const { document: doc } = win;
  const world = doc.getElementById("world");
  const origin = box(world.getBoundingClientRect());
  const scale = new win.DOMMatrixReadOnly(win.getComputedStyle(world).transform).a;
  const viewport = rect(0, 0, win.innerWidth, win.innerHeight);
  const objects = new Map(state.scene.objects.map(node => [node.id, node]));
  const entries = [...world.querySelectorAll(":scope > .node[data-id]:not([hidden])")].map((el, order) => {
    const node = objects.get(el.dataset.id);
    const content = el.querySelector(".node-content");
    const bounds = scaleBox(box(el.getBoundingClientRect()), scale, origin);
    const runs = textRuns(content);
    const heading = node.type === "board" ? runs.flatMap(run => run.boxes.map(r => scaleBox(r, scale, origin))) : [];
    const variant = (node.variants || []).filter(v => v.minZoom <= state.camera.s).at(-1);
    return {
      node, content, bounds, runs, heading, order, layer: Number(el.style.zIndex),
      type: variant?.type || node.type, variantMinZoom: variant?.minZoom ?? null
    };
  });
  const findings = [];
  let totalFindings = 0;
  function add(type, severity, entry, measurements, suggestion, other) {
    totalFindings++;
    if (findings.length === MAX_FINDINGS) return;
    findings.push({
      type, severity, objectId: entry.node.id, component: entry.type, variantMinZoom: entry.variantMinZoom,
      ...(other && { relatedObjectId: other.node.id }), measurements, suggestion
    });
  }

  function isAncestor(ancestor, child) {
    for (let parent = child.node.parent; parent; parent = objects.get(parent)?.parent) {
      if (parent === ancestor.node.id) return true;
    }
    return false;
  }

  for (const entry of entries) {
    const { node, content, bounds, runs } = entry;
    const contentBox = box(content.getBoundingClientRect());
    const structuralBoxes = [...content.children]
      .filter(el => !el.classList.contains("sheet-mark"))
      .map(el => scaleBox(box(el.getBoundingClientRect()), scale, origin));
    const textBoxes = runs.filter(run => !run.scroll)
      .flatMap(run => run.boxes.map(r => scaleBox(r, scale, origin)));
    const overflow = [...structuralBoxes, ...textBoxes].filter(r => !contains(bounds, r));
    if (overflow.length) {
      const required = rect(
        Math.min(bounds.x, ...overflow.map(r => r.x)), Math.min(bounds.y, ...overflow.map(r => r.y)),
        Math.max(right(bounds), ...overflow.map(right)) - Math.min(bounds.x, ...overflow.map(r => r.x)),
        Math.max(bottom(bounds), ...overflow.map(bottom)) - Math.min(bounds.y, ...overflow.map(r => r.y))
      );
      add("content_overflow", "error", entry, {
        bounds: reportBox(bounds), occupiedBounds: reportBox(required),
        client: { w: content.clientWidth, h: content.clientHeight },
        scroll: { w: content.scrollWidth, h: content.scrollHeight }
      }, "Increase available width or height, shorten the content, or split it into another card. Revalidate the active variant.");
    }
    const [minW, minH] = layoutContract.components[entry.type].minimum;
    if (node.w < minW || node.h < minH) {
      add("below_component_minimum", "warning", entry, {
        width: node.w, height: node.h, minWidth: minW, minHeight: minH
      }, "Resize the object to the component minimum or use a compact component with less content.");
    }

    const small = runs.filter(run => {
      const viewingArea = run.scroll ? intersection(viewport, box(run.scroll.getBoundingClientRect()), 0) : viewport;
      return viewingArea && run.fontSize * scale < minTextPx - 0.1 &&
        run.boxes.some(r => intersection(r, viewingArea, 0) && intersection(r, contentBox, 0));
    });
    if (small.length) add("text_below_readable_size", "warning", entry, {
      smallestPx: rounded(Math.min(...small.map(run => run.fontSize * scale))), minTextPx,
      fields: [...new Set(small.map(run => run.field))]
    }, "Use a focused camera sample or a concise semantic variant and give its content sufficient room. Check readability again at the intended viewport.");
  }

  for (const board of entries.filter(entry => entry.node.type === "board")) {
    const depth = Math.min(board.bounds.h, Math.max(layoutContract.boardHeading.minimumDepth,
      ...board.heading.map(r => bottom(r) - board.bounds.y + layoutContract.boardHeading.clearance)));
    const zone = rect(board.bounds.x, board.bounds.y, board.bounds.w, depth);
    for (const entry of entries) {
      if (entry === board || isAncestor(entry, board)) continue;
      const descendant = isAncestor(board, entry);
      const inFront = entry.layer > board.layer || entry.layer === board.layer && entry.order > board.order;
      if (descendant && !contains(board.bounds, entry.bounds)) add("child_outside_board", "error", entry, {
        bounds: reportBox(entry.bounds), boardBounds: reportBox(board.bounds)
      }, "Move or resize the child to fit within the board, or give it a different parent.", board);
      if (!inFront) continue;
      const covered = board.heading.map(r => intersection(r, entry.bounds)).find(Boolean);
      if (covered) add("heading_obstructed", "error", entry, {
        intersection: reportBox(covered), headingZone: reportBox(zone), minimumBoardLocalY: rounded(depth)
      }, "Move the covering object below the heading zone or outside the board. Reserve room for wrapped headings.", board);
      else if (descendant && intersection(zone, entry.bounds)) add("heading_zone_intrusion", "warning", entry, {
        headingZone: reportBox(zone), minimumBoardLocalY: rounded(depth)
      }, "Move the child below the heading zone so labels and headings have clear space.", board);
    }
  }
  for (const [i, entry] of entries.entries()) {
    for (const other of entries.slice(i + 1)) {
      const overlap = intersection(entry.bounds, other.bounds);
      if (overlap && !isAncestor(entry, other) && !isAncestor(other, entry)) {
        add("object_overlap", "error", other, {
          intersection: reportBox(overlap), bounds: reportBox(other.bounds), relatedBounds: reportBox(entry.bounds)
        }, "Move or resize one object so the boxes no longer intersect. Use a parent board for intentional containment.", entry);
      }
    }
  }

  return {
    viewport: { width: win.innerWidth, height: win.innerHeight }, zoom: state.camera.s,
    worldUnitPx: Math.round(scale * 10000) / 10000, minTextPx, renderedObjects: entries.length,
    totalFindings, omittedFindings: totalFindings - findings.length, findings
  };
}

function settled(win) {
  return new Promise((resolve, reject) => {
    let frame;
    const timer = setTimeout(() => {
      win.cancelAnimationFrame(frame);
      reject(Error("Layout renderer did not paint; make the Canvas visible and retry"));
    }, 1000);
    frame = win.requestAnimationFrame(() => {
      frame = win.requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
    });
  });
}

async function measurePreviewSamples(frame, scene, samples) {
  const win = frame.contentWindow;
  const preview = win.contextarium;
  if (!preview) throw Error("Layout preview renderer unavailable");
  const results = [];
  for (const sample of samples) {
    frame.style.width = sample.width + "px";
    frame.style.height = sample.height + "px";
    await settled(win);
    // Use the canonical renderer while suppressing preview-only behaviour and source effects.
    preview.loadScene({ ...scene, behaviours: [], sources: {} });
    if (sample.focus) preview.batch([{ command: "camera.focus", target: sample.focus, durationMs: 0 }]);
    if (sample.zoom !== undefined) {
      const { x, y } = preview.getState().camera;
      preview.batch([{ command: "camera.set", x, y, s: sample.zoom, durationMs: 0 }]);
    }
    await settled(win);
    const minimum = sample.minTextPx ?? (sample.focus ? layoutContract.readableTextPx : 0);
    results.push({ ...(sample.focus && { focus: sample.focus }), ...layoutSample(win, preview.getState(), minimum) });
  }
  return results;
}

export async function validateLayout(scene, samples) {
  if (!samples?.length) {
    await settled(window);
    return [layoutSample(window, window.contextarium.getState(), 0)];
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed", left: "-10000px", top: "0", border: "0", opacity: "0", pointerEvents: "none",
    width: samples[0].width + "px", height: samples[0].height + "px"
  });
  const loaded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Layout preview did not load")), 4000);
    frame.onload = () => { clearTimeout(timer); resolve(); };
    frame.onerror = () => { clearTimeout(timer); reject(new Error("Layout preview failed to load")); };
  });
  frame.src = "./layout-preview";
  document.body.append(frame);
  try {
    await loaded;
    return await measurePreviewSamples(frame, scene, samples);
  } finally {
    frame.remove();
  }
}
