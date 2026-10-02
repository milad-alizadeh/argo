import type { LiveSessionCommand } from '@/harnesses/registration'
import type { UserInput } from '../app-server'

type CodexInputItem = Extract<UserInput, { type: 'text' | 'localImage' }>
export const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000

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

export function inputItems(command: LiveSessionCommand): CodexInputItem[] {
  const items: CodexInputItem[] = [{ type: 'text', text: command.prompt, text_elements: [] }]
  for (const attachment of command.attachments) {
    if (attachment.kind === 'image') items.push({ type: 'localImage', path: attachment.path })
    else
      items.push({
        type: 'text',
        text: attachment.path,
        text_elements: [
          {
            byteRange: { start: 0, end: Buffer.byteLength(attachment.path) },
            placeholder: attachment.path,
          },
        ],
      })
  }
  return items
}
