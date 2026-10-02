// The Claude ACP adapter's own answers about its mock: where the executable goes, where its
// Sessions land, and the words it answers a prompt with.
import { chmod, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type {
  AgentCapabilities,
  ListSessionsResponse,
  PermissionOption,
} from '@agentclientprotocol/sdk'
import type { MockHarness } from '../mock-cli'
import { mockClaudeAcpFolder, mockClaudeAcpReply } from './mock-claude-acp-transcripts'

// A run always starts in `apps/desktop`; `import.meta` is unavailable once Playwright loads this as CommonJS.
const MOCK_CLAUDE_ACP = path.join(process.cwd(), 'mocks', 'cli', 'claude-acp', 'mock-claude-acp.ts')
const ALIAS_HOOKS = path.join(process.cwd(), 'mocks', 'cli', 'mock-cli-alias-hooks.mts')

export type MockClaudeAcpOptions = {
  capabilities?: AgentCapabilities
  listing?: ListSessionsResponse
  permissionOptions?: PermissionOption[]
}

// An executable `claude-agent-acp` the app can spawn: this node, running the mock beside this file.
export async function writeMockClaudeAcp(
  root: string,
  transcripts: string,
  options: MockClaudeAcpOptions = {},
) {
  const executable = path.join(root, 'claude-agent-acp')
  const configuration = path.join(root, 'mock-acp-options.json')
  await writeFile(
    configuration,
    JSON.stringify({ ...options, requestLog: path.join(root, 'mock-acp-requests.jsonl') }),
  )
  await writeFile(
    executable,
    `#!/bin/sh\nexec "${process.execPath}" --no-warnings --import "${ALIAS_HOOKS}" "${MOCK_CLAUDE_ACP}" "${transcripts}" "${configuration}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}

// The mock agent's own Session files; Argo reads ACP history through the agent, not these files.
async function recordedByClaudeAcp(_root: string, transcripts: string, mark: string) {
  const folder = mockClaudeAcpFolder(transcripts)
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  const records = await Promise.all(
    names.map((name) => readFile(path.join(folder, name), 'utf8').catch(() => '')),
  )
  return records.some((record) => record.includes(mark))
}

export const mockClaudeAcpHarness: MockHarness = {
  write: writeMockClaudeAcp,
  replyMark: mockClaudeAcpReply,
  recorded: recordedByClaudeAcp,
}
