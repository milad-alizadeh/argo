import { createHash } from 'node:crypto'
import {
  getSessionInfo,
  getSessionMessages,
  getSubagentMessages,
  listSessions,
} from '@anthropic-ai/claude-agent-sdk'
import {
  managedRosterRow,
  type SessionFeedRow,
  type SessionRosterRow,
} from '@/domains/sessions/contract/model/models'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript/transcript-file'
import { driveSessionError } from '@/domains/sessions/contract/session-error'
import { discoverRoster } from '@/domains/sessions/main/observation/reader/discover-roster'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import { matchesSearchQuery } from '@/domains/sessions/main/projection/search/search-match'
import { isRecord } from '@/shared/validation'
import { identifierTag, normalizeClaudeRecords, parseTranscriptLine } from '../transcript'
import {
  type ClaudeSdkHistory,
  readClaudeSessionMessages,
  readClaudeSessionPage,
  readClaudeSessions,
  readClaudeSubagentMessages,
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

function watchedRows(sessions: StoredSession[]) {
  return sessions
    .filter((session) => !isRelayOutput(session))
    .map(rowOf)
    .filter((row) => row !== null)
    .map((row) => ({ ...row, posture: 'watched' as const }))
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

async function searchClaudeHistory(
  history: ClaudeSdkHistory,
  managed: SessionRosterRow[],
  query: string,
) {
  const sessions = await readClaudeSessions(history)
  reportPageIssues(sessions)
  const discovered = await discoverRoster({
    discovery: {
      rows: watchedRows(sessions),
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

function feedOf(
  sessionId: string,
  messages: Awaited<ReturnType<typeof readClaudeSessionMessages>>,
  cwd: string | null,
): SessionFeedRow[] {
  const records = messages
    .flatMap((message) => parseTranscriptLine(JSON.stringify(message)) ?? [])
    .map((record) =>
      record.kind === 'message' && record.cwd === null && cwd !== null
        ? { ...record, cwd }
        : record,
    )
  const file = transcriptFileFrom(`sdk://${sessionId}`, {
    sessionId,
    records: normalizeClaudeRecords(records),
  })
  const chain = stitchChains([file])[0]
  return chain === undefined ? [] : projectFeed(chain, undefined).rows
}

function subagentAgentIds(messages: Awaited<ReturnType<typeof readClaudeSessionMessages>>) {
  const identifiers = new Map<string, string>()
  for (const message of messages) {
    const raw =
      isRecord(message.message) && typeof message.message.content === 'string'
        ? message.message.content
        : ''
    const callId = identifierTag(raw, 'tool-use-id')
    const agentId = identifierTag(raw, 'task-id')
    if (callId !== null && agentId !== null) identifiers.set(callId, agentId)
  }
  return identifiers
}

async function readSubagent(options: {
  history: ClaudeSdkHistory
  subagents: Map<string, Map<string, string>>
  sessionId: string
  subagentId: string
}) {
  const { history, subagents, sessionId, subagentId } = options
  const agentId = subagents.get(sessionId)?.get(subagentId)
  if (agentId === undefined) return null
  const messages = await readClaudeSubagentMessages(history, sessionId, agentId)
  if (messages === null) return null
  const records = messages.flatMap((message) => parseTranscriptLine(JSON.stringify(message)) ?? [])
  const file = transcriptFileFrom(`sdk://${sessionId}/${agentId}`, {
    sessionId: agentId,
    records: normalizeClaudeRecords(records),
  })
  return stitchChains([file])[0] ?? null
}

async function readObservedSubagentFeed(options: {
  history: ClaudeSdkHistory
  subagents: Map<string, Map<string, string>>
  sessionId: string
  subagentId: string
}) {
  const { history, subagents, sessionId, subagentId } = options
  const child = await readSubagent({ history, subagents, sessionId, subagentId })
  if (child === null) return null
  const rows = projectFeed(child, undefined).rows
  return {
    chainId: child.id,
    revision: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    rows,
  }
}

function createFeedReaders(
  history: ClaudeSdkHistory,
  sessions: Map<string, StoredSession>,
  managedSessions: () => SessionRosterRow[],
) {
  const subagents = new Map<string, Map<string, string>>()
  return {
    readObservedFeed: async (sessionId: string) => {
      const managed = managedSessions().some((row) => row.id === sessionId)
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
      subagents.set(sessionId, subagentAgentIds(messages))
      const cwd = sessions.get(sessionId)?.cwd ?? info?.cwd ?? null
      const rows = feedOf(sessionId, messages, cwd)
      return {
        chainId: sessionId,
        revision: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
        rows,
      }
    },
    readObservedSubagentFeed: (sessionId: string, subagentId: string) =>
      readObservedSubagentFeed({ history, subagents, sessionId, subagentId }),
    readSubagentFiles: (sessionId: string, subagentId: string) =>
      readSubagent({ history, subagents, sessionId, subagentId }),
  }
}

function createSessionRosterReader(options: {
  history: ClaudeSdkHistory
  sessions: Map<string, StoredSession>
  currentRoster: Map<string, StoredSession>
  managedSessions: () => SessionRosterRow[]
  countTranscriptFiles: (() => Promise<number>) | undefined
}) {
  const { history, sessions, currentRoster, managedSessions, countTranscriptFiles } = options
  return async (request?: Parameters<SessionSource['discoverSessions']>[0]) => {
    const offset = offsetFor(request?.cursor)
    const sessionsOnPage = await readClaudeSessionPage(history, offset)
    if (offset === 0) currentRoster.clear()
    for (const session of sessionsOnPage) {
      sessions.set(session.sessionId, session)
      currentRoster.set(session.sessionId, session)
    }
    const pageComplete = sessionsOnPage.length < ROSTER_PAGE_SIZE
    const sessionsToCount = Array.from(currentRoster.values())
    const filesFound = countTranscriptFiles ? await countTranscriptFiles() : currentRoster.size
    const sdkOmitted = pageComplete ? Math.max(0, filesFound - currentRoster.size) : 0
    const pageStats = rosterStatistics(sessionsToCount, filesFound, sdkOmitted)
    reportPageIssues(sessionsOnPage)
    if (pageComplete && sdkOmitted > 0) {
      console.warn('Claude SDK omitted transcript records from the Session roster', { sdkOmitted })
    }
    return discoverRoster({
      discovery: {
        rows: watchedRows(sessionsOnPage),
        ...pageStats,
        nextCursor: pageComplete ? null : String(offset + sessionsOnPage.length),
        historyComplete: pageComplete && sdkOmitted === 0,
      },
      managed: managedSessions(),
      joins: {},
      projectRoot: request?.projectRoot,
    })
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
    getSubagentMessages,
  }
  const sessions = new Map<string, StoredSession>()
  const currentRoster = new Map<string, StoredSession>()
  const managedSessions = options.managedSessions ?? (() => [])
  const rosterReader = createSessionRosterReader({
    history,
    sessions,
    currentRoster,
    managedSessions,
    countTranscriptFiles: options.countTranscriptFiles,
  })
  const feedReaders = createFeedReaders(history, sessions, managedSessions)
  return {
    harness: 'claude',
    discoverSessions: rosterReader,
    searchSessions: (query) => searchClaudeHistory(history, managedSessions(), query),
    historyComplete: async () => true,
    readSessionFiles: async () => null,
    ...feedReaders,
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
