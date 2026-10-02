import type { LiveSessionCommand } from '@/harnesses/registration'

type Settle = { resolve: () => void; reject: (error: Error) => void }
// A compaction runs as its own Turn, in queue order with the Sends around it.
export type CodexCompaction = { commandId: string; compaction: Settle }
export type CodexQueuedWork = LiveSessionCommand | CodexCompaction
export type CodexActiveTurn = {
  commandId: string
  turnId: string | null
  started: boolean
  compaction?: Settle
}

// A closing channel runs no compaction it holds, so each one fails.
export function abandonCompactions(active: CodexActiveTurn | null, queue: CodexQueuedWork[]) {
  const closing = new Error('Codex Session channel is closed.')
  active?.compaction?.reject(closing)
  for (const work of queue) if ('compaction' in work) work.compaction.reject(closing)
}
