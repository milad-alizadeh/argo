import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import type {
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'
import { createClaudeStatusHooks } from './claude-status-hooks'

const run = promisify(execFile)
const AGENTS_TIMEOUT_MS = 10_000

// `claude agents --json` (claude 2.1.286): an interactive Session carries `status`, and
// `waitingFor` while it waits. A background Session carries `state` and is not listed here.
const interactiveSchema = z.looseObject({
  kind: z.literal('interactive'),
  sessionId: z.string().min(1),
  status: z.string().min(1),
  waitingFor: z.string().min(1).optional(),
})
const backgroundSchema = z.looseObject({ kind: z.literal('background') })
const entrySchema = z.discriminatedUnion('kind', [interactiveSchema, backgroundSchema])
type InteractiveEntry = z.infer<typeof interactiveSchema>
const agentStatusSchema = z.enum(['busy', 'waiting', 'idle'])

// The `waitingFor` values the agent view documents.
const WAITING_STATUS: Readonly<Record<string, ExternalSessionStatus>> = {
  'permission prompt': 'permission',
  'sandbox request': 'permission',
  'worker request': 'permission',
  'input needed': 'asking',
  'dialog open': 'asking',
}

// The Session status of one entry, or null for a value Claude does not document.
function entryStatus({ status, waitingFor }: InteractiveEntry): ExternalSessionStatus | null {
  const known = agentStatusSchema.safeParse(status)
  if (!known.success) return null
  const value = known.data
  switch (value) {
    case 'busy':
      return 'running'
    case 'idle':
      return 'idle'
    case 'waiting':
      return waitingFor !== undefined && Object.hasOwn(WAITING_STATUS, waitingFor)
        ? (WAITING_STATUS[waitingFor] ?? null)
        : null
    default:
      return value satisfies never
  }
}

// When one Session has several entries, the most urgent one stands.
const URGENCY: Record<ExternalSessionStatus, number> = {
  permission: 4,
  asking: 3,
  running: 2,
  unknown: 1,
  idle: 0,
}

// Each listed Session's status, the most urgent where one Session has several entries, and how
// many entries had an undocumented shape or value.
function liveStatuses(entries: readonly unknown[]) {
  const statuses = new Map<string, ExternalSessionStatus>()
  let rejected = 0
  for (const value of entries) {
    const entry = entrySchema.safeParse(value)
    if (!entry.success) rejected += 1
    if (!entry.success || entry.data.kind === 'background') continue
    const status = entryStatus(entry.data)
    if (status === null) rejected += 1
    const shown = status ?? 'unknown'
    const before = statuses.get(entry.data.sessionId)
    if (before === undefined || URGENCY[shown] > URGENCY[before])
      statuses.set(entry.data.sessionId, shown)
  }
  return { statuses, rejected }
}

// The interactive Sessions Claude runs outside Argo, with their status, from `claude agents
// --json`. It gives no activity line, and Argo reads no transcript or pid file for one (ADR-0047).
// A status hook outranks it.
export function createClaudeExternalSessions(
  executable: string | null,
  settingsFile: string,
): ExternalSessions {
  async function listLive() {
    if (executable === null) throw new Error('No claude executable was found.')
    const { stdout } = await run(executable, ['agents', '--json'], { timeout: AGENTS_TIMEOUT_MS })
    const { statuses, rejected } = liveStatuses(z.array(z.unknown()).parse(JSON.parse(stdout)))
    const sessions: LiveExternalSession[] = [...statuses].map(([nativeId, status]) => ({
      nativeId,
      status,
      transcript: null,
    }))
    return { sessions, rejected }
  }
  return { listLive, hooks: createClaudeStatusHooks(settingsFile) }
}
