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
  readClaudeSessionPage,
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

type StoredSession = Awaited<ReturnType<typeof readClaudeSessionPage>>[number]

const ROSTER_PAGE_SIZE = 50

function offsetFor(cursor: string | null | undefined) {
  if (cursor === null || cursor === undefined) return 0
  const parsed = Number.parseInt(cursor, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
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

function feedOf(messages: Awaited<ReturnType<typeof readClaudeSessionMessages>>): SessionFeedRow[] {
  return messages.flatMap((message) => {
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
    const offset = offsetFor(options?.cursor)
    const page = await readClaudeSessionPage(history, offset)
    for (const session of page) sessions.set(session.sessionId, session)
    revision += 1
    return { sessions: page, offset }
  }
  return {
    harness: 'claude',
    discoverSessions: async (request) => {
      const { sessions: sessionsOnPage, offset } = await refresh(request)
      return discoverRoster({
        discovery: {
          rows: sessionsOnPage.map(rowOf).map((row) => ({ ...row, posture: 'watched' as const })),
          filesFound: 0,
          filesRead: 0,
          filesUnreadable: 0,
          filesParsed: 0,
          nextCursor:
            sessionsOnPage.length < ROSTER_PAGE_SIZE
              ? null
              : String(offset + sessionsOnPage.length),
          historyComplete: sessionsOnPage.length < ROSTER_PAGE_SIZE,
        },
        managed: options.managedSessions?.() ?? [],
        joins: {},
        projectRoot: request?.projectRoot,
      })
    },
    readSessionFiles: async () => null,
    readObservedFeed: async (sessionId) => {
      const session = sessions.get(sessionId)
      return session === undefined
        ? null
        : {
            chainId: sessionId,
            revision: String(revision),
            rows: feedOf(await readClaudeSessionMessages(history, session.sessionId)),
          }
    },
    readShellOutput: async () => ({ state: 'absent' }),
  }
}
