import type { AgentPty } from '../agentTerminals'

/** A stand-in for a node-pty handle: it records what was written to it and lets a test push output
 * as the agent would. Shared by the registry's tests and the bridge's, which drive the same port
 * from either end. */
export interface FakePty extends AgentPty {
  written: string[]
  sizes: string[]
  emit(chunk: string): void
}

export function fakePty(): FakePty {
  const listeners: ((chunk: string) => void)[] = []
  return {
    written: [],
    sizes: [],
    onData: (listener) => listeners.push(listener),
    write(data) {
      this.written.push(data)
    },
    resize(cols, rows) {
      this.sizes.push(`${cols}x${rows}`)
    },
    emit(chunk) {
      for (const listener of listeners) listener(chunk)
    },
  }
}
