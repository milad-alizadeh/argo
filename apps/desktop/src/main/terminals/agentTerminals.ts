// The agent PTYs Argo owns, held for the whole life of the process that spawned them (#323).
//
// A managed Session's Dock steers THE AGENT, not a sibling shell in the same folder — so the pty
// `spawnSession` creates is kept here rather than drained into nothing, and a Dock attaches to it
// by the claim that owns it. Two things this registry must never do: stop reading the pty (an
// unread pty back-pressures until the child stalls), and kill it when a Dock goes away (the agent
// outlives the pane that watches it).

/** The slice of a node-pty handle this registry uses. Narrow on purpose: `IPty` satisfies it
 * structurally, and a test drives an agent without loading a native module. */
export interface AgentPty {
  onData(listener: (chunk: string) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
}

/** How much of an agent's output is kept for a Dock that attaches after the fact. A Dock opens
 * long after ⌘N — the id it attaches by does not exist until the CLI has written its first
 * records — so with no replay the pane would open blank on a session mid-flight. Bounded because
 * this is a live tail, not a transcript: the transcript is on disk and is the durable record. */
export const REPLAY_LIMIT = 200_000

export interface AttachedTerminal {
  /** Keystrokes to the agent — this is what "you steer by typing at its prompt" means. */
  write(data: string): void
  /** Match the pty to the viewport after a fit. */
  resize(cols: number, rows: number): void
  /** Stop delivering to this viewer. The agent keeps running and keeps being drained. */
  detach(): void
}

export interface AgentTerminals {
  /** Take ownership of a freshly spawned agent's pty, keyed by its ownership claim. */
  adopt(id: string, pty: AgentPty): void
  /** The pty exited: there is nothing left to steer. */
  drop(id: string): void
  /** Watch and steer one agent, or `null` when no live pty answers to that claim. */
  attach(id: string, onData: (chunk: string) => void): AttachedTerminal | null
}

interface Adopted {
  pty: AgentPty
  replay: string
  viewers: Set<(chunk: string) => void>
}

export function createAgentTerminals(): AgentTerminals {
  const agents = new Map<string, Adopted>()

  return {
    adopt(id, pty) {
      const entry: Adopted = { pty, replay: '', viewers: new Set() }
      agents.set(id, entry)
      // Subscribing HERE, once, is the drain: it runs whether or not a Dock is watching, which is
      // what keeps the agent from stalling between panes.
      pty.onData((chunk) => {
        entry.replay = (entry.replay + chunk).slice(-REPLAY_LIMIT)
        for (const viewer of entry.viewers) viewer(chunk)
      })
    },

    drop(id) {
      agents.delete(id)
    },

    attach(id, onData) {
      const entry = agents.get(id)
      if (entry === undefined) return null
      entry.viewers.add(onData)
      if (entry.replay !== '') onData(entry.replay)
      // node-pty throws on a child that exited between the renderer's last read and this call, and
      // a handle already handed out keeps working after `drop`. A keystroke into a dead agent is
      // nothing to do, never a crash in main.
      const ifAlive = (act: () => void): void => {
        try {
          act()
        } catch {
          // agent is gone
        }
      }
      return {
        write: (data) => ifAlive(() => entry.pty.write(data)),
        resize: (cols, rows) => ifAlive(() => entry.pty.resize(cols, rows)),
        detach: () => {
          entry.viewers.delete(onData)
        },
      }
    },
  }
}
