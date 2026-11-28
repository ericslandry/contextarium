
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
    const changed = this.#automatic !== automatic;
    this.#automatic = automatic;
    if (!automatic && this.#pending?.kind === 'conversation') {
      this.#pending = undefined;
      clearTimeout(this.#timer);
    }
    if (!automatic && this.#active?.kind === 'conversation') {
      this.#active.controller.abort(new Error('Automatic composition paused'));
    }
    if (changed && !this.#pending && (!this.#active || this.#active.controller.signal.aborted)) {
      this.onStatus(automatic ? 'Automatic composition on' : 'Automatic composition paused', 'notice');
    }
    return this.#automatic;
  }

  observe(turn) {
    if (this.#closed || /^\/(?:contextarium[:/])?feedback(?:\s|$)/i.test(turn.user?.trimStart())) return;
    this.#context = [...this.#context.slice(-3), turn];
    if (!this.#automatic) return;
    this.workspace.advanceContext();
    if (this.#pending?.kind !== 'explicit') {
      this.#pending = { kind: 'conversation' };
      this.#schedule(this.delay);
    }
    if (this.#active?.kind === 'conversation') this.#active.controller.abort(new Error('Superseded by a newer conversation turn'));
  }

  request(intent, context = '') {
    if (this.#closed) return false;
    this.workspace.advanceContext();
    this.#pending = { kind: 'explicit', intent, context };
    this.#active?.controller.abort(new Error('Superseded by a newer visualization request'));
    this.#schedule(0);
    return true;
  }

  #schedule(delay) {
    if (this.#active || this.#closed) return;
    clearTimeout(this.#timer);
    this.onStatus('Composition queued', 'busy');
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
    this.onStatus('Composing', 'busy');
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
      const showResult = result.status === 'committed' || (result.status === 'unchanged' && request.kind === 'explicit');
      this.onStatus(result.status === 'committed' ? 'Workspace updated' :
        result.status === 'stale' ? 'Superseded update discarded' : 'Workspace is current', showResult ? 'notice' : 'idle');
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        this.onStatus(message || 'Composition failed', 'error');
      }
    } finally {
      this.#active = undefined;
      if (this.#pending) this.#schedule(this.#pending.kind === 'explicit' ? 0 : this.delay);
    }
  }

  reset(reason = 'Workspace reset') {
    this.#pending = undefined;
    clearTimeout(this.#timer);
    this.#active?.controller.abort(new Error(reason));
  }

  close() {
    this.#closed = true;
    this.reset('Session closed');
  }
}
