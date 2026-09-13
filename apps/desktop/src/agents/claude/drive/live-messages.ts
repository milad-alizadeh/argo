import { z } from 'zod'

// A Message as Claude Code has drawn it so far; `id` is the hook's `message_id`, which no
// transcript record carries.
export type LiveMessage = { id: string; text: string }

const displayBatchSchema = z.object({
  turn_id: z.string().min(1),
  message_id: z.string().min(1),
  index: z.number().int().nonnegative(),
  delta: z.string(),
})

function joined(batches: Map<number, string>) {
  let text = ''
  for (let index = 0; batches.has(index); index += 1) text += batches.get(index)
  return text
}

// The Messages of the running Turn, each held as the MessageDisplay batches it arrived in.
export function createLiveMessages() {
  let turnId: string | null = null
  const retired = new Set<string>()
  const messages = new Map<string, Map<number, string>>()
  return {
    record(value: unknown) {
      const parsed = displayBatchSchema.safeParse(value)
      if (!parsed.success || retired.has(parsed.data.turn_id)) return
      const batch = parsed.data
      if (batch.turn_id !== turnId) {
        turnId = batch.turn_id
        messages.clear()
      }
      const batches = messages.get(batch.message_id) ?? new Map<number, string>()
      batches.set(batch.index, batch.delta)
      messages.set(batch.message_id, batches)
    },
    list: (): LiveMessage[] =>
      [...messages].map(([id, batches]) => ({ id, text: joined(batches) })),
    // Argo's next Turn begins with a prompt row, and what came before it can no longer be matched
    // by order, so the Turn it follows streams no further.
    retire() {
      if (turnId !== null) retired.add(turnId)
      turnId = null
      messages.clear()
    },
  }
}

export type LiveMessages = ReturnType<typeof createLiveMessages>
