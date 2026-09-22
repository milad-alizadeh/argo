import { query } from '@anthropic-ai/claude-agent-sdk'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import type { ClaudeQueryFactory } from './types'

export const createClaudeQuery: ClaudeQueryFactory = ({
  prompt,
  cwd,
  resume,
  canUseTool,
  onUserDialog,
}) =>
  query({
    prompt,
    options: {
      cwd,
      resume,
      canUseTool,
      onUserDialog,
      pathToClaudeCodeExecutable: process.env[SESSION_CLAUDE_EXECUTABLE_ENV],
    },
  })
