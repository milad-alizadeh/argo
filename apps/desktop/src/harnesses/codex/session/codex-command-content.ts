import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'

const commandSchema = z.object({
  id: z.string().min(1),
  type: z.literal('commandExecution'),
  command: z.string().nullable().optional(),
  cwd: z.string().nullable().optional(),
  status: z.enum(['inProgress', 'completed', 'failed', 'interrupted', 'declined']).optional(),
  aggregatedOutput: z.string().nullable().optional(),
  exitCode: z.number().int().nullable().optional(),
})

export function codexCommandContent(
  raw: unknown,
  phase: 'started' | 'completed',
): FeedContent | null {
  const parsed = commandSchema.safeParse(raw)
  if (!parsed.success) return null
  const item = parsed.data
  let status: Extract<FeedContent, { kind: 'command' }>['status']
  switch (phase === 'started' ? 'inProgress' : item.status) {
    case 'inProgress':
      status = 'running'
      break
    case 'completed':
      status = 'completed'
      break
    case 'failed':
    case 'declined':
      status = 'failed'
      break
    case 'interrupted':
      status = 'interrupted'
      break
    case undefined:
      status = 'completed'
      break
  }
  return {
    kind: 'command',
    id: item.id,
    command: item.command ?? null,
    cwd: item.cwd ?? null,
    status,
    output: item.aggregatedOutput ?? null,
    stderr: null,
    exitCode: item.exitCode ?? null,
  }
}
