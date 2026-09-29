import { z } from 'zod'
import type { CodexRequest } from '../app-server/codex-app-server-client'

// `thread.agentNickname` in protocol-generated/v2/thread.ts: the random name Codex gave a spawned thread.
const nicknameResponseSchema = z.object({
  thread: z.object({ agentNickname: z.string().min(1).nullable() }),
})

// A nickname never changes once given, so each thread is read once per client; a failed read is
// tried again on the next one.
const readsByClient = new WeakMap<CodexRequest, Map<string, Promise<string | null>>>()

export function readCodexNickname(request: CodexRequest, threadId: string): Promise<string | null> {
  const reads = readsByClient.get(request) ?? new Map<string, Promise<string | null>>()
  readsByClient.set(request, reads)
  const earlier = reads.get(threadId)
  if (earlier !== undefined) return earlier
  const reading = request('thread/read', { threadId, includeTurns: false }, (value) => value).then(
    (value) => {
      const parsed = nicknameResponseSchema.safeParse(value)
      if (parsed.success) return parsed.data.thread.agentNickname
      console.warn('Rejected 1 unsupported Codex Subagent thread shape.')
      return null
    },
    () => {
      reads.delete(threadId)
      console.warn('Could not read 1 Codex Subagent thread; it shows no nickname.')
      return null
    },
  )
  reads.set(threadId, reading)
  return reading
}
