import type { SDKSessionInfo, SessionMessage } from '@anthropic-ai/claude-agent-sdk'

const PAGE_SIZE = 50

export class ClaudeSdkHistoryUnavailableError extends Error {
  readonly code = 'vendor-history-unavailable' as const

  constructor(message = 'Claude Session history is unavailable.') {
    super(message)
  }
}

export type ClaudeSdkHistory = {
  listSessions: (options: { limit: number; offset: number }) => Promise<SDKSessionInfo[]>
  listAllSessions?: () => Promise<SDKSessionInfo[]>
  getSessionInfo?: (sessionId: string) => Promise<SDKSessionInfo | undefined>
  getSessionMessages: (
    sessionId: string,
    options: { limit: number; offset: number },
  ) => Promise<SessionMessage[]>
  getSubagentMessages?: (
    sessionId: string,
    agentId: string,
    options: { limit: number; offset: number },
  ) => Promise<SessionMessage[]>
}

// The SDK owns its storage format. Argo only requests complete pages of vendor history (#2583).
async function readPages<Value>(readPage: (offset: number) => Promise<Value[]>): Promise<Value[]> {
  const values: Value[] = []
  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await readPage(offset)
      values.push(...page)
      if (page.length < PAGE_SIZE) return values
    }
  } catch (error) {
    if (error instanceof ClaudeSdkHistoryUnavailableError) throw error
    throw new ClaudeSdkHistoryUnavailableError(error instanceof Error ? error.message : undefined)
  }
}

export async function readClaudeSessions(history: ClaudeSdkHistory): Promise<SDKSessionInfo[]> {
  if (history.listAllSessions !== undefined) {
    try {
      return await history.listAllSessions()
    } catch (error) {
      throw new ClaudeSdkHistoryUnavailableError(error instanceof Error ? error.message : undefined)
    }
  }
  return readPages((offset) => history.listSessions({ limit: PAGE_SIZE, offset }))
}

export async function readClaudeSessionPage(
  history: ClaudeSdkHistory,
  offset: number,
): Promise<SDKSessionInfo[]> {
  try {
    return await history.listSessions({ limit: PAGE_SIZE, offset })
  } catch (error) {
    throw new ClaudeSdkHistoryUnavailableError(error instanceof Error ? error.message : undefined)
  }
}

export async function readClaudeSessionMessages(
  history: ClaudeSdkHistory,
  sessionId: string,
): Promise<SessionMessage[]> {
  return readPages((offset) => history.getSessionMessages(sessionId, { limit: PAGE_SIZE, offset }))
}

export async function readClaudeSubagentMessages(
  history: ClaudeSdkHistory,
  sessionId: string,
  agentId: string,
): Promise<SessionMessage[] | null> {
  if (history.getSubagentMessages === undefined) return null
  return readPages(
    (offset) =>
      history.getSubagentMessages?.(sessionId, agentId, { limit: PAGE_SIZE, offset }) ??
      Promise.resolve([]),
  )
}
