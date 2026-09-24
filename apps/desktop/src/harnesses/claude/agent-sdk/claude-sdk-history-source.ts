import {
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
import { discoverRoster } from '@/domains/sessions/main/observation/reader/discover-roster'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import { isRecord } from '@/shared/validation'
import { identifierTag, normalizeClaudeRecords, parseTranscriptLine } from '../transcript'
import {
  type ClaudeSdkHistory,
  readClaudeSessionMessages,
  readClaudeSessionPage,
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
  revision: number
}) {
  const { history, subagents, sessionId, subagentId, revision } = options
  const child = await readSubagent({ history, subagents, sessionId, subagentId })
  if (child === null) return null
  return {
    chainId: child.id,
    revision: String(revision),
    rows: projectFeed(child, undefined).rows,
  }
}

export function createClaudeSdkHistorySource(
  options: { history?: ClaudeSdkHistory; managedSessions?: () => SessionRosterRow[] } = {},
): SessionSource {
  const history: ClaudeSdkHistory = options.history ?? {
    listSessions,
    getSessionMessages,
    getSubagentMessages,
  }
  const sessions = new Map<string, StoredSession>()
  const subagents = new Map<string, Map<string, string>>()
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
      if (session === undefined) return null
      const messages = await readClaudeSessionMessages(history, session.sessionId)
      subagents.set(sessionId, subagentAgentIds(messages))
      return {
        chainId: sessionId,
        revision: String(revision),
        rows: feedOf(session.sessionId, messages, session.cwd ?? null),
      }
    },
    readObservedSubagentFeed: (sessionId, subagentId) =>
      readObservedSubagentFeed({ history, subagents, sessionId, subagentId, revision }),
    readSubagentFiles: (sessionId, subagentId) =>
      readSubagent({ history, subagents, sessionId, subagentId }),
    readShellOutput: async () => ({ state: 'absent' }),
  }
}
