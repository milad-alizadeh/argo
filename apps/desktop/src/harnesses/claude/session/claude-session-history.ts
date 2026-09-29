import {
  getSessionMessages,
  getSubagentMessages,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { decodeClaudeHistoryContent } from './claude-feed-decoder'
import { ClaudeFeedProjection } from './claude-feed-projection'
import { type ClaudeSkillFile, claudeSkillFiles } from './claude-skill-files'
import { type ClaudeSkillDirectories, readClaudeSkillDirectories } from './claude-skill-records'

export function decodeClaudeSessionMessages(
  messages: readonly SessionMessage[],
  skillFile: ClaudeSkillFile = () => null,
  skillDirectories: () => ClaudeSkillDirectories = () => new Map(),
): FeedContent[] {
  let rejected = 0
  const projection = new ClaudeFeedProjection(skillFile, skillDirectories)
  const content = messages.flatMap((entry) =>
    decodeClaudeHistoryContent(entry, () => {
      rejected += 1
    }).flatMap((decoded) => projection.project(decoded)),
  )
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude history shape(s).`)
  return content
}

export async function readClaudeSessionHistory(
  nativeId: string,
  cwd: string | null,
  subagentId: string | null = null,
): Promise<FeedContent[]> {
  const options = cwd === null ? {} : { dir: cwd }
  const messages =
    subagentId === null
      ? await getSessionMessages(nativeId, options)
      : await getSubagentMessages(nativeId, subagentId, options)
  let directories: ClaudeSkillDirectories | null = null
  // A Subagent's records live in its own file, which holds no recorded folder of the Session's.
  return decodeClaudeSessionMessages(messages, claudeSkillFiles(cwd), () => {
    directories ??= subagentId === null ? readClaudeSkillDirectories(nativeId) : new Map()
    return directories
  })
}
