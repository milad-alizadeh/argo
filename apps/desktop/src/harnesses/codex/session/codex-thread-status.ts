import { z } from 'zod'

// The four arms of the app-server `ThreadStatus` union (ADR-0024 "What says a Codex Session is working").
const threadStatusNotificationSchema = z.object({
  threadId: z.string().min(1),
  status: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('active'),
      activeFlags: z.array(z.enum(['waitingOnApproval', 'waitingOnUserInput'])),
    }),
    z.object({ type: z.literal('idle') }),
    z.object({ type: z.literal('systemError') }),
    z.object({ type: z.literal('notLoaded') }),
  ]),
})

export type CodexThreadStatusReading = {
  threadId: string
  status: 'running' | 'permission' | 'asking' | 'idle' | 'unknown' | null
} | null

// `systemError` degrades to `unknown`, and `notLoaded` claims nothing; null rejects the shape.
export function readCodexThreadStatus(params: unknown): CodexThreadStatusReading {
  const parsed = threadStatusNotificationSchema.safeParse(params)
  if (!parsed.success) return null
  const { threadId, status } = parsed.data
  switch (status.type) {
    case 'active':
      if (status.activeFlags.includes('waitingOnApproval'))
        return { threadId, status: 'permission' }
      if (status.activeFlags.includes('waitingOnUserInput')) return { threadId, status: 'asking' }
      return { threadId, status: 'running' }
    case 'idle':
      return { threadId, status: 'idle' }
    case 'systemError':
      return { threadId, status: 'unknown' }
    case 'notLoaded':
      return { threadId, status: null }
  }
}
