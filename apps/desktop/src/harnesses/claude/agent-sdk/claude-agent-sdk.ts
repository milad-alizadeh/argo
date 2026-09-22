import { query, renameSession } from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeQueryFactory } from '@/harnesses/claude/agent-sdk/types'

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
    },
  })

export { renameSession }
