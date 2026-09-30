import type { RouterInputs } from '@/platform/renderer/trpc-client'

export type SessionListAnchor = RouterInputs['sessionListWindow']['anchor']
export type SessionListWindowRead<Window> = (anchor: SessionListAnchor) => Promise<Window>

// How long changes gather before the one read they share: each Feed reader a window move opens
// publishes activity once, and every publication invalidates the list.
const CHANGE_DELAY_MS = 50

// One list view's window reads: none before the change listener is attached, one in flight, and at
// most one more for whatever changed during it. A read for an anchor since left is dropped.
export class SessionListWindowReader<Window> {
  readonly #read: SessionListWindowRead<Window>
  readonly #publish: (window: Window) => void
  readonly #fail: () => void
  readonly #schedule: (run: () => void) => void
  #anchor: SessionListAnchor = { kind: 'start' }
  #generation = 0
  #attached = false
  #inFlight = false
  #scheduled = false
  #changed = false
  #sought = false
  #disposed = false

  constructor(options: {
    read: SessionListWindowRead<Window>
    publish: (window: Window) => void
    fail: () => void
    schedule?: (run: () => void) => void
  }) {
    this.#read = options.read
    this.#publish = options.publish
    this.#fail = options.fail
    this.#schedule = options.schedule ?? ((run) => setTimeout(run, CHANGE_DELAY_MS))
  }

  // The change listener is attached, or something the view shows committed since.
  invalidate(): void {
    if (this.#disposed) return
    if (!this.#attached) {
      this.#attached = true
      this.#start()
      return
    }
    this.#changed = true
    if (!this.#inFlight) this.#scheduleChange()
  }

  seek(anchor: SessionListAnchor): void {
    if (this.#disposed) return
    this.#anchor = anchor
    this.#generation += 1
    if (!this.#attached) return
    if (this.#inFlight) this.#sought = true
    else this.#start()
  }

  dispose(): void {
    this.#disposed = true
  }

  #scheduleChange(): void {
    if (this.#scheduled) return
    this.#scheduled = true
    this.#schedule(() => {
      this.#scheduled = false
      if (this.#changed) this.#start()
    })
  }

  #start(): void {
    if (this.#disposed || this.#inFlight) return
    this.#inFlight = true
    this.#changed = false
    this.#sought = false
    const generation = this.#generation
    this.#read(this.#anchor).then(
      (window) => this.#settle(generation, () => this.#publish(window)),
      () => this.#settle(generation, this.#fail),
    )
  }

  #settle(generation: number, deliver: () => void): void {
    this.#inFlight = false
    if (this.#disposed) return
    if (generation === this.#generation) deliver()
    else this.#sought = true
    if (this.#sought) this.#start()
    else if (this.#changed) this.#scheduleChange()
  }
}
