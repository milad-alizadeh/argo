import type { Harness } from '@/harnesses/harness'
import { mockClaudeHistoryLines } from '../cli/claude/mock-claude-history-lines'
import { mockCodexHistoryLines } from '../cli/codex/mock-codex-history-lines'

// The lines one Harness appends to a Session's history file, for a test that watches the file.
export type MockHistoryLines = {
  file: (root: string, nativeId: string) => string
  prompt: (text: string) => string[]
  command: (command: string) => string[]
  answer: (text: string) => string[]
  // A record that carries no Feed content.
  bookkeeping: () => string
}

export const MOCK_HISTORY_LINES = {
  claude: mockClaudeHistoryLines,
  codex: mockCodexHistoryLines,
} as const satisfies Partial<Record<Harness, () => MockHistoryLines>>
