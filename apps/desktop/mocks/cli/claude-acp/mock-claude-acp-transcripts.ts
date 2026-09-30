import path from 'node:path'

// The root a packaged proof hands the mock; the agent owns its Sessions, so none sit in the fixture tree.
export function mockClaudeAcpRoot(proofRoot: string) {
  return path.join(proofRoot, 'claude-acp-sessions')
}

// Where the mock `claude-agent-acp` keeps its Sessions, under the transcript root a fixture hands it.
export function mockClaudeAcpFolder(transcripts: string) {
  return path.join(transcripts, 'mock-claude-acp')
}

export function mockClaudeAcpReply(prompt: string) {
  return `Mock Claude ACP read: ${prompt}`
}
