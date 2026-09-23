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

function timestampOf(session: StoredSession): string | null {
  const timestamp = session.createdAt ?? session.lastModified
  if (timestamp === null || timestamp === undefined) return null
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isRelayOutput(session: StoredSession) {
  return session.firstPrompt?.startsWith('AGENT OUTPUT:') === true
}

function rowOf(session: StoredSession) {
  const startedAt = timestampOf(session)
  if (startedAt === null) return null
  return managedRosterRow({
    id: session.sessionId,
    session: {
      harness: 'claude',
      cwd: session.cwd ?? null,
      prompt: session.firstPrompt ?? session.summary,
      setup: { model: null, effort: null, mode: null },
      startedAt,
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

function recordPageIssues(sessions: StoredSession[], filesFound = sessions.length) {
  const untitled = sessions.filter(
    (session) => !session.customTitle && !session.summary && !session.firstPrompt,
  ).length
  const missingTimestamps = sessions.filter((session) => timestampOf(session) === null).length
  const relayOutput = sessions.filter(isRelayOutput).length
  const rejected = sessions.filter(
    (session) =>
      timestampOf(session) === null ||
      (!session.customTitle && !session.summary && !session.firstPrompt),
  ).length
  if (untitled + missingTimestamps + relayOutput > 0) {
    console.warn('Claude SDK Session boundary rejected records', {
      untitled,
      missingTimestamps,
      relayOutput,
    })
  }
  return {
    filesFound,
    filesRead: sessions.length,
    filesUnreadable: rejected + Math.max(0, filesFound - sessions.length),
    filesParsed: sessions.length - rejected - relayOutput,
  }
}

function rosterRows(sessions: StoredSession[]) {
  return sessions
    .filter((session) => !isRelayOutput(session))
    .map(rowOf)
    .filter((row) => row !== null)
    .map((row) => ({ ...row, posture: 'watched' as const }))
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
  options: {
    history?: ClaudeSdkHistory
    managedSessions?: () => SessionRosterRow[]
    countTranscriptFiles?: () => Promise<number>
  } = {},
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
      const pageComplete = sessionsOnPage.length < ROSTER_PAGE_SIZE
      const sessionsToCount = pageComplete ? Array.from(sessions.values()) : sessionsOnPage
      const filesFound = options.countTranscriptFiles
        ? await options.countTranscriptFiles()
        : sessionsOnPage.length
      const pageStats = recordPageIssues(sessionsToCount, Math.max(filesFound, sessions.size))
      const sdkOmitted = Math.max(0, filesFound - sessions.size)
      if (pageComplete && sdkOmitted > 0) {
        console.warn('Claude SDK omitted transcript records from the Session roster', {
          sdkOmitted,
        })
      }
      return discoverRoster({
        discovery: {
          rows: rosterRows(sessionsOnPage),
          ...pageStats,
          nextCursor: pageComplete ? null : String(offset + sessionsOnPage.length),
          historyComplete: pageComplete && sdkOmitted === 0,
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
