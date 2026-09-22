import { z } from 'zod'

// Pinned to the app-server method table (#2581). `thread/turns/list` is experimental;
// `thread/read` is the supported history read.
export const EXPERIMENTAL_TURN_PAGE_METHOD = 'thread/turns/list'
export const STORED_THREAD_READ_METHOD = 'thread/read'
export const STORED_THREAD_LIST_METHOD = 'thread/list'
export const LOADED_THREAD_LIST_METHOD = 'thread/loaded/list'

const HISTORY_METHODS = [
  STORED_THREAD_LIST_METHOD,
  STORED_THREAD_READ_METHOD,
  EXPERIMENTAL_TURN_PAGE_METHOD,
  LOADED_THREAD_LIST_METHOD,
] as const

export type HistoryMethod = (typeof HISTORY_METHODS)[number]

export type HistoryTransport = {
  request: (method: HistoryMethod, params: Record<string, unknown>) => Promise<unknown>
}

export const STATUS_TYPES = {
  idle: 'idle',
  notLoaded: 'notLoaded',
  active: 'active',
  systemError: 'systemError',
} as const

type VendorStatusType = keyof typeof STATUS_TYPES | 'unknown'

export type VendorStatus = {
  type: VendorStatusType
  message?: string
  activeFlags?: string[]
}

export const ITEM_ROLES = {
  userMessage: 'user',
  UserMessage: 'user',
  agentMessage: 'agent',
  AgentMessage: 'agent',
} as const

export const TOOL_ITEMS = {
  commandExecution: 'tool',
  CommandExecution: 'tool',
} as const

export const TURN_STATUSES = {
  completed: 'completed',
  interrupted: 'interrupted',
  failed: 'failed',
  inProgress: 'running',
} as const

export type StoredItem = {
  id: string
  turnId: string
  role: 'user' | 'agent' | 'tool'
  text: string
  name: string
  status: 'running' | 'completed' | 'failed'
}

export type StoredTurn = {
  id: string
  status: 'running' | 'completed' | 'interrupted' | 'failed'
  startedAt: number
  items: StoredItem[]
}

export type StoredThread = {
  id: string
  cwd: string | null
  title: string | null
  branch: string | null
  updatedAt: number | null
  status: VendorStatus
  turns: StoredTurn[]
}

export class CodexHistoryUnavailableError extends Error {
  readonly code = 'vendor-history-unavailable' as const

  constructor(message = 'Session history is unavailable.') {
    super(message)
    this.name = 'CodexHistoryUnavailableError'
  }
}

export const statusSchema = z.looseObject({
  type: z.string(),
  message: z.string().optional(),
  activeFlags: z.array(z.string()).optional(),
})

const userInputSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
})

export const itemSchema = z.looseObject({
  id: z.string().min(1),
  type: z.string().min(1),
  text: z.string().optional(),
  content: z.array(userInputSchema).optional(),
  command: z.string().optional(),
  status: z.string().optional(),
})

export const turnSchema = z.looseObject({
  id: z.string().min(1),
  status: z.string().optional(),
  startedAt: z.number().optional(),
  items: z.array(itemSchema).optional(),
})

export const threadSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  cwd: z.string().nullable().optional(),
  preview: z.string().optional(),
  updatedAt: z.number().nullable().optional(),
  branch: z.string().nullable().optional(),
  status: statusSchema.optional(),
  turns: z.array(turnSchema).optional(),
})

export const listSchema = z.looseObject({
  data: z.array(threadSchema),
  nextCursor: z.string().nullable().optional(),
})

export const readSchema = z.looseObject({
  thread: threadSchema,
})

export const pageSchema = z.looseObject({
  data: z.array(turnSchema),
  nextCursor: z.string().nullable().optional(),
})

export const loadedSchema = z.looseObject({
  data: z.array(z.string()).optional(),
  threadIds: z.array(z.string()).optional(),
  nextCursor: z.string().nullable().optional(),
})

export const PAGE_LIMIT = 20
