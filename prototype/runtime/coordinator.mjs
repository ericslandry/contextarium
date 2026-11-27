
export class Coordinator {
  #pending;
  #active;
  #timer;
  #closed = false;
  #context = [];
  #automatic = false;

  constructor({ workspace, compose, presentation, onStatus = () => {}, delay = 450 }) {
    Object.assign(this, { workspace, compose, presentation, onStatus, delay });
  }

  configure(automatic) {
    this.#automatic = automatic;
    if (!automatic && this.#pending?.kind === 'conversation') this.#pending = undefined;
    if (!automatic && this.#active?.kind === 'conversation') this.#active.controller.abort();
    return this.#automatic;
  }

  observe(turn) {
    if (this.#closed) return;
    this.#context = [...this.#context.slice(-3), turn];
    if (!this.#automatic) return;
    this.workspace.advanceContext();
    if (this.#pending?.kind !== 'explicit') {
      this.#pending = { kind: 'conversation' };
      this.#schedule(this.delay);
    }
  }

  request(intent, context = '') {
    if (this.#closed) return false;
    this.workspace.advanceContext();
    this.#pending = { kind: 'explicit', intent, context };
    this.#schedule(0);
    return true;
  }

  #schedule(delay) {
    if (this.#active || this.#closed) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => { void this.#run(); }, delay);
  }

  async #run() {
    if (!this.#pending || this.#closed) return;
    const request = this.#pending;
    this.#pending = undefined;
    const ticket = this.workspace.ticket();
    const presentation = this.presentation();
    const controller = new AbortController();
    this.#active = { controller, kind: request.kind };
    this.onStatus('Composing');
    try {
      const candidate = await this.compose({
        request, workspace: this.workspace.snapshot(), presentation, conversation: structuredClone(this.#context),
      }, controller.signal);
      if (controller.signal.aborted) return;
      const result = this.workspace.commit(ticket, candidate, presentation);
      if (result.status === 'stale' && request.kind === 'explicit' && this.#pending?.kind !== 'explicit' &&
          this.workspace.ticket().generation === ticket.generation) {
        this.#pending = request;
      }
      this.onStatus(result.status === 'committed' ? 'Workspace updated' :
        result.status === 'stale' ? 'Superseded update discarded' : 'Workspace is current');
    } catch {
      this.onStatus(controller.signal.aborted ? 'Composition cancelled' : 'Composition failed');
    } finally {
      this.#active = undefined;
      if (this.#pending) this.#schedule(this.#pending.kind === 'explicit' ? 0 : this.delay);
    }
  }

  reset() {
    this.#pending = undefined;
    clearTimeout(this.#timer);
    this.#active?.controller.abort();
  }

  close() {
    this.#closed = true;
    this.reset();
  }
}
