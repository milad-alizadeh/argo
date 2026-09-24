import { createHash } from 'node:crypto'
import { getSessionInfo, getSessionMessages, listSessions } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  managedRosterRow,
  type SessionFeedRow,
  type SessionRosterRow,
} from '@/domains/sessions/contract/model/models'
import { driveSessionError } from '@/domains/sessions/contract/session-error'
import { discoverRoster } from '@/domains/sessions/main/observation/reader/discover-roster'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import { matchesSearchQuery } from '@/domains/sessions/main/projection/search/search-match'
import {
  type ClaudeSdkHistory,
  readClaudeSessionMessages,
  readClaudeSessionPage,
  readClaudeSessions,
} from './claude-sdk-history'

const textBlock = z.object({ type: z.literal('text'), text: z.string() })
const messageText = z
  .object({ content: z.union([z.string(), z.array(z.unknown())]) })
  .transform(({ content }) => {
    if (typeof content === 'string') return content
    const parts = content.flatMap((block) => {
      const text = textBlock.safeParse(block)
      return text.success ? [text.data.text] : []
    })
    return parts.length > 0 ? parts.join('') : null
  })

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

function rosterStatistics(
  sessions: StoredSession[],
  filesFound = sessions.length,
  filesOmitted = 0,
) {
  const relayOutput = sessions.filter(isRelayOutput).length
  const rejected = sessions.filter(
    (session) =>
      timestampOf(session) === null ||
      (!session.customTitle && !session.summary && !session.firstPrompt),
  ).length
  return {
    filesFound,
    filesRead: sessions.length,
    filesUnreadable: rejected + filesOmitted,
    filesParsed: sessions.length - rejected - relayOutput,
  }
}

function reportPageIssues(sessions: StoredSession[]) {
  const untitled = sessions.filter(
    (session) => !session.customTitle && !session.summary && !session.firstPrompt,
  ).length
  const missingTimestamps = sessions.filter((session) => timestampOf(session) === null).length
  const relayOutput = sessions.filter(isRelayOutput).length
  if (untitled + missingTimestamps + relayOutput > 0) {
    console.warn('Claude SDK Session boundary rejected records', {
      untitled,
      missingTimestamps,
      relayOutput,
    })
  }
}

function rosterRows(sessions: StoredSession[]) {
  return sessions
    .filter((session) => !isRelayOutput(session))
    .map(rowOf)
    .filter((row) => row !== null)
    .map((row) => ({ ...row, posture: 'watched' as const }))
}

async function searchClaudeHistory(
  history: ClaudeSdkHistory,
  managed: SessionRosterRow[],
  query: string,
) {
  const sessions = await readClaudeSessions(history)
  const discovered = await discoverRoster({
    discovery: {
      rows: rosterRows(sessions),
      ...rosterStatistics(sessions),
      nextCursor: null,
      historyComplete: true,
    },
    managed,
    joins: {},
    projectRoot: null,
  })
  return discovered.rows.filter((row) => matchesSearchQuery(row, query))
}

function feedOf(messages: Awaited<ReturnType<typeof readClaudeSessionMessages>>): SessionFeedRow[] {
  return messages.flatMap((message) => {
    if (message.type === 'system') return []
    const text = messageText.safeParse(message.message)
    if (!text.success || text.data === null) return []
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

function discoverClaudeRosterPage(options: {
  sessions: StoredSession[]
  managed: SessionRosterRow[]
  projectRoot: string | null | undefined
  offset: number
  pageComplete: boolean
  pageStats: ReturnType<typeof rosterStatistics>
  sdkOmitted: number
}) {
  const { sessions, managed, projectRoot, offset, pageComplete, pageStats, sdkOmitted } = options
  reportPageIssues(sessions)
  if (pageComplete && sdkOmitted > 0) {
    console.warn('Claude SDK omitted transcript records from the Session roster', { sdkOmitted })
  }
  return discoverRoster({
    discovery: {
      rows: rosterRows(sessions),
      ...pageStats,
      nextCursor: pageComplete ? null : String(offset + sessions.length),
      historyComplete: pageComplete && sdkOmitted === 0,
    },
    managed,
    joins: {},
    projectRoot,
  })
}

function createRosterRefresh(
  history: ClaudeSdkHistory,
  sessions: Map<string, StoredSession>,
  currentRoster: Map<string, StoredSession>,
) {
  return async (request?: Parameters<SessionSource['discoverSessions']>[0]) => {
    const offset = offsetFor(request?.cursor)
    const page = await readClaudeSessionPage(history, offset)
    if (offset === 0) currentRoster.clear()
    for (const session of page) {
      sessions.set(session.sessionId, session)
      currentRoster.set(session.sessionId, session)
    }
    return { sessions: page, offset }
  }
}

async function readObservedClaudeFeed(options: {
  history: ClaudeSdkHistory
  managedSessions: SessionRosterRow[]
  sessions: Map<string, StoredSession>
  sessionId: string
}) {
  const { history, managedSessions, sessions, sessionId } = options
  const managed = managedSessions.some((row) => row.id === sessionId)
  const messages = await readClaudeSessionMessages(history, sessionId)
  const info =
    !managed && messages.length === 0 ? await history.getSessionInfo?.(sessionId) : undefined
  const cachedSession = sessions.get(sessionId)
  const cachedTitle = cachedSession === undefined ? '' : titleOf(cachedSession).text
  if (
    !managed &&
    messages.length === 0 &&
    info === undefined &&
    (!cachedSession || cachedTitle.length === 0)
  )
    return null
  const rows = feedOf(messages)
  return {
    chainId: sessionId,
    revision: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    rows,
  }
}

export function createClaudeSdkHistorySource(
  options: {
    history?: ClaudeSdkHistory
    managedSessions?: () => SessionRosterRow[]
    countTranscriptFiles?: () => Promise<number>
    renameManagedSession?: (sessionId: string, title: string) => Promise<void>
  } = {},
): SessionSource {
  const history: ClaudeSdkHistory = options.history ?? {
    listSessions,
    listAllSessions: () => listSessions(),
    getSessionInfo,
    getSessionMessages,
  }
  const sessions = new Map<string, StoredSession>()
  const currentRoster = new Map<string, StoredSession>()
  const refresh = createRosterRefresh(history, sessions, currentRoster)
  return {
    harness: 'claude',
    discoverSessions: async (request) => {
      const { sessions: sessionsOnPage, offset } = await refresh(request)
      const pageComplete = sessionsOnPage.length < ROSTER_PAGE_SIZE
      const sessionsToCount = Array.from(currentRoster.values())
      const filesFound = options.countTranscriptFiles
        ? await options.countTranscriptFiles()
        : currentRoster.size
      const sdkOmitted = pageComplete ? Math.max(0, filesFound - currentRoster.size) : 0
      const pageStats = rosterStatistics(sessionsToCount, filesFound, sdkOmitted)
      return discoverClaudeRosterPage({
        sessions: sessionsOnPage,
        managed: options.managedSessions?.() ?? [],
        projectRoot: request?.projectRoot,
        offset,
        pageComplete,
        pageStats,
        sdkOmitted,
      })
    },
    searchSessions: (query) =>
      searchClaudeHistory(history, options.managedSessions?.() ?? [], query),
    historyComplete: async () => true,
    readSessionFiles: async () => null,
    readObservedFeed: (sessionId) =>
      readObservedClaudeFeed({
        history,
        managedSessions: options.managedSessions?.() ?? [],
        sessions,
        sessionId,
      }),
    readShellOutput: async () => ({ state: 'absent' }),
    ...createRenameOperation(options),
  }
}

function createRenameOperation(options: {
  managedSessions?: () => SessionRosterRow[]
  renameManagedSession?: (sessionId: string, title: string) => Promise<void>
}): Pick<SessionSource, 'rename'> {
  if (options.renameManagedSession === undefined) return {}
  return {
    rename: async (request) => {
      const managed = options
        .managedSessions?.()
        .some((session) => session.id === request.sessionId)
      if (!managed) return driveSessionError('not-drivable', 'claude', request.requestId)
      await options.renameManagedSession?.(request.sessionId, request.name)
      return {
        version: 1,
        type: 'session.renamed',
        requestId: request.requestId,
        sessionId: request.sessionId,
        title: request.name,
      }
    },
  }
}
