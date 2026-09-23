import { getSessionMessages, listSessions } from '@anthropic-ai/claude-agent-sdk'
import {
  managedRosterRow,
  type SessionFeedRow,
  type SessionRosterRow,
} from '@/domains/sessions/contract/model/models'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript/transcript-file'
import { discoverRoster } from '@/domains/sessions/main/observation/reader/discover-roster'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import { normalizeClaudeRecords } from '../sessions/discovery/normalize-records'
import { parseTranscriptLine } from '../sessions/records/records'
import {
  type ClaudeSdkHistory,
  readClaudeSessionMessages,
  readClaudeSessionPage,
} from './claude-sdk-history'

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

function feedOf(
  sessionId: string,
  messages: Awaited<ReturnType<typeof readClaudeSessionMessages>>,
): SessionFeedRow[] {
  const records = messages
    .filter((message) => message.type !== 'system')
    .flatMap((message) => parseTranscriptLine(JSON.stringify(message)) ?? [])
  const file = transcriptFileFrom(`sdk://${sessionId}`, {
    sessionId,
    records: normalizeClaudeRecords(records),
  })
  const chain = stitchChains([file])[0]
  return chain === undefined ? [] : projectFeed(chain, undefined).rows
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
            rows: feedOf(
              session.sessionId,
              await readClaudeSessionMessages(history, session.sessionId),
            ),
          }
    },
    readShellOutput: async () => ({ state: 'absent' }),
  }
}
