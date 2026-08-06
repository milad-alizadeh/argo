// Which agent program is running (CONTEXT.md L2 — the Session's `cli`), and which one a
// Project spawns. One union serves both because they name the same program: the Project's
// Agent/CLI choice is what ⌘N launches, and the Session that comes back reports that word.

export const CLIS = ['claude', 'codex'] as const

export type Cli = (typeof CLIS)[number]

/** Whether a value read from outside — a hand-edited registry, an IPC payload — names a CLI
 * Argo can launch. An unknown word is not a CLI, so the caller falls back rather than
 * spawning a program nobody chose. */
export function isCli(value: unknown): value is Cli {
  return typeof value === 'string' && CLIS.some((cli) => cli === value)
}
