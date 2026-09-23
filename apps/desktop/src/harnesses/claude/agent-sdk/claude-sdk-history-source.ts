import { getSessionMessages, listSessions } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  managedRosterRow,
  type SessionFeedRow,
  type SessionRosterRow,
} from '@/domains/sessions/contract/model/models'
import { discoverRoster } from '@/domains/sessions/main/observation/reader/discover-roster'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import {
  type ClaudeSdkHistory,
  readClaudeSessionMessages,
  readClaudeSessions,
} from './claude-sdk-history'

const messageText = z
  .object({
    content: z.union([
      z.string(),
      z
        .array(z.object({ type: z.literal('text'), text: z.string() }))
        .transform((blocks) => blocks.map((block) => block.text).join('')),
    ]),
  })
  .transform(({ content }) => content)

type StoredSession = Awaited<ReturnType<typeof readClaudeSessions>>[number] & {
  messages: Awaited<ReturnType<typeof readClaudeSessionMessages>>
}

const ROSTER_PAGE_SIZE = 50

function windowSize(cursor: string | null | undefined) {
  if (cursor === null || cursor === undefined) return ROSTER_PAGE_SIZE
  const parsed = Number.parseInt(cursor, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ROSTER_PAGE_SIZE
}

function titleOf(session: StoredSession) {
  if (session.customTitle !== undefined)
    return { text: session.customTitle, source: 'custom' as const }
  if (session.summary !== undefined) return { text: session.summary, source: 'summarised' as const }
  return { text: session.firstPrompt ?? '', source: 'first-prompt' as const }
}

function rowOf(session: StoredSession) {
  return managedRosterRow({
    id: session.sessionId,
    session: {
      harness: 'claude',
      cwd: session.cwd ?? null,
      prompt: session.firstPrompt ?? session.summary,
      setup: { model: null, effort: null, mode: null },
      startedAt: new Date(session.createdAt ?? session.lastModified).toISOString(),
      status: 'idle',
      title: titleOf(session),
      compactionPercentage: null,
      compactionStartedAt: null,
      compactionTokens: null,
      handoffFailure: null,
      handoffStartedAt: null,
    },
  })
}

function feedOf(session: StoredSession): SessionFeedRow[] {
  return session.messages.flatMap((message) => {
    if (message.type === 'system') return []
    const text = messageText.safeParse(message.message)
    if (!text.success) return []
    return [
      {
        shape: 'prose' as const,
        id: message.uuid,
        role: message.type === 'user' ? 'user' : 'assistant',
        text: text.data,
      },
    ]
  })
}

export function createClaudeSdkHistorySource(
  options: { history?: ClaudeSdkHistory; managedSessions?: () => SessionRosterRow[] } = {},
): SessionSource {
  const history: ClaudeSdkHistory = options.history ?? { listSessions, getSessionMessages }
  const sessions = new Map<string, StoredSession>()
  let revision = 0
  const refresh = async (options?: Parameters<SessionSource['discoverSessions']>[0]) => {
    const listed = await readClaudeSessions(history)
    const size = windowSize(options?.cursor)
    const visible = listed.slice(0, size)
    const sessionsWithMessages = await Promise.all(
      visible.map(async (session) => ({
        ...session,
        messages: await readClaudeSessionMessages(history, session.sessionId),
      })),
    )
    sessions.clear()
    for (const session of sessionsWithMessages) sessions.set(session.sessionId, session)
    revision += 1
    return { sessions: sessionsWithMessages, total: listed.length, size }
  }
  return {
    harness: 'claude',
    discoverSessions: async (request) => {
      const { sessions: sessionsWithMessages, total, size } = await refresh(request)
      return discoverRoster({
        discovery: {
          rows: sessionsWithMessages
            .map(rowOf)
            .map((row) => ({ ...row, posture: 'watched' as const })),
          filesFound: 0,
          filesRead: 0,
          filesUnreadable: 0,
          filesParsed: 0,
          nextCursor: total > size ? String(size + ROSTER_PAGE_SIZE) : null,
          historyComplete: true,
        },
        managed: options.managedSessions?.() ?? [],
        joins: {},
        projectRoot: request?.projectRoot,
      })
    },
    readSessionFiles: async () => null,
    readObservedFeed: (sessionId) => {
      const session = sessions.get(sessionId)
      return session === undefined
        ? null
        : { chainId: sessionId, revision: String(revision), rows: feedOf(session) }
    },
    readShellOutput: async () => ({ state: 'absent' }),
  }
}
