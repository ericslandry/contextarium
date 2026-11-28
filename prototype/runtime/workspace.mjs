
const maxCompositions = 150;
const maxSource = 600_000;
const maxCoordinate = 1_000_000;
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const textFields = ['html', 'css', 'js'];

function text(value, field, limit = maxSource) {
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid ' + field);
  return value;
}

function number(value, field, min = -maxCoordinate, max = maxCoordinate) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error('Invalid ' + field);
  return value;
}

export function composition(value) {
  if (!value || !idPattern.test(value.id) || typeof value.id !== 'string') throw new Error('Invalid composition ID');
  const result = {
    id: value.id,
    title: text(value.title, 'title', 160),
    x: number(value.x, 'x'),
    y: number(value.y, 'y'),
    width: number(value.width, 'width', 16, 10_000),
    height: number(value.height, 'height', 16, 10_000),
    scale: number(value.scale ?? 1, 'scale', 0.001, 100),
    opacity: number(value.opacity ?? 1, 'opacity', 0, 1),
    parent: value.parent ?? null,
  };
  if (result.parent !== null && (typeof result.parent !== 'string' || !idPattern.test(result.parent))) {
    throw new Error('Invalid breadcrumb parent');
  }
  for (const field of textFields) result[field] = text(value[field] ?? '', field);
  return result;
}

function validateScene(compositions) {
  if (compositions.size > maxCompositions) throw new Error('Too many compositions');
  let totalSource = 0;
  for (const item of compositions.values()) {
    totalSource += textFields.reduce((size, field) => size + item[field].length, 0);
    const ancestors = new Set([item.id]);
    for (let parent = item.parent; parent; parent = compositions.get(parent).parent) {
      if (ancestors.has(parent) || !compositions.has(parent)) throw new Error('Invalid breadcrumb ancestry for ' + item.id);
      ancestors.add(parent);
    }
  }
  if (totalSource > 2_000_000) throw new Error('Workspace source exceeds the document size limit');
}

function validateDocument(document) {
  if (document?.format !== 'contextarium-workspace' || document.version !== 1 || !Array.isArray(document.compositions)) {
    throw new Error('Expected a Contextarium workspace document, version 1');
  }
  const result = new Map();
  for (const value of document.compositions) {
    const item = composition(value);
    if (result.has(item.id)) throw new Error('Duplicate composition ID: ' + item.id);
    result.set(item.id, item);
  }
  validateScene(result);
  return result;
}

export class Workspace {
  #items = new Map();
  #revision = 0;
  #generation = 0;
  #freshness = 0;
  #closed = false;
  #listeners = new Set();

  constructor(sessionId, initialDocument) {
    this.sessionId = sessionId;
    if (initialDocument !== undefined) this.#items = validateDocument(initialDocument);
  }

  ticket() {
    return { sessionId: this.sessionId, generation: this.#generation, revision: this.#revision, freshness: this.#freshness };
  }

  snapshot() {
    return { generation: this.#generation, revision: this.#revision, ...this.export() };
  }

  export() {
    return { format: 'contextarium-workspace', version: 1, compositions: structuredClone([...this.#items.values()]) };
  }

  advanceContext() {
    this.#freshness++;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #publish(update) {
    for (const listener of this.#listeners) listener(update);
  }

  import(document, base) {
    if (this.#closed || base?.generation !== this.#generation || base.revision !== this.#revision) return { status: 'stale' };
    const next = validateDocument(document);
    this.#items = next;
    this.#generation++;
    this.#revision = 0;
    const snapshot = this.snapshot();
    this.#publish({ type: 'snapshot', snapshot });
    return { status: 'committed', revision: this.#revision };
  }

  commit(ticket, candidate, presentation) {
    const current = this.ticket();
    if (this.#closed || Object.keys(current).some(key => current[key] !== ticket?.[key])) return { status: 'stale' };
    if (!Array.isArray(candidate?.upsert) || !Array.isArray(candidate.remove) ||
        candidate.upsert.length > maxCompositions || candidate.remove.length > maxCompositions) {
      throw new Error('Expected bounded upsert and remove arrays');
    }
    const next = new Map(this.#items);
    const removals = new Set();
    for (const id of candidate.remove) {
      if (!next.delete(id)) throw new Error('Unknown or duplicate removal: ' + id);
      removals.add(id);
    }
    const updates = new Map();
    for (const value of candidate.upsert) {
      const item = composition(value);
      if (updates.has(item.id) || removals.has(item.id)) throw new Error('Ambiguous update: ' + item.id);
      updates.set(item.id, item);
      next.set(item.id, item);
    }
    validateScene(next);
    const target = candidate.focusId || null;
    if (target && !next.has(target)) throw new Error('Unknown focus target: ' + target);
    const guidance = target && presentation?.follow ? {
      id: target, rendererId: presentation.rendererId, epoch: presentation.epoch,
    } : null;
    if (!updates.size && !removals.size && !guidance) return { status: 'unchanged' };

    const baseRevision = this.#revision;
    this.#items = next;
    this.#revision++;
    this.#publish({
      type: 'delta', generation: this.#generation, baseRevision, revision: this.#revision,
      upsert: structuredClone([...updates.values()]), remove: [...removals], guidance,
    });
    return { status: 'committed', revision: this.#revision };
  }

  close() {
    this.#closed = true;
    this.#generation++;
    this.#listeners.clear();
    this.#items.clear();
  }
}
