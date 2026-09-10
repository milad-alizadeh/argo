export const SESSION_POSTURES = ['managed', 'external', 'orphaned'] as const
export const SESSION_ENTRIES = ['interactive', 'headless'] as const
export const SESSION_STATUSES = [
  'starting',
  'running',
  'permission',
  'asking',
  'idle',
  'stopped',
  'ended',
  'unknown',
] as const
export const TITLE_SOURCES = ['custom', 'summarised', 'first-prompt'] as const

export type SessionPosture = (typeof SESSION_POSTURES)[number]
export type SessionEntry = (typeof SESSION_ENTRIES)[number]
export type SessionStatus = (typeof SESSION_STATUSES)[number]
export type SessionTitle = { text: string; source: (typeof TITLE_SOURCES)[number] }

export type SessionRosterRow = {
  id: string
  retiredIds: string[]
  cli: string
  posture: SessionPosture
  title: SessionTitle | null
  status: SessionStatus
  entry: SessionEntry
  cwd: string | null
  branch: string | null
  updatedAt: string | null
  unreadableLines: number
  originUnread: boolean
}

export type SessionFeedRow =
  | { shape: 'prose'; id: string; role: 'user' | 'assistant'; text: string }
  | { shape: 'source'; id: string; role: 'user' | 'assistant'; label: string; source: string }
  | { shape: 'unreadable'; id: string }
