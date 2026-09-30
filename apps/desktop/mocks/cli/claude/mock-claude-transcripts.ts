import path from 'node:path'

// Where the mock claude finds the transcript root the fixture hands it: `<CLAUDE_CONFIG_DIR>/projects`.
export const MOCK_CLAUDE_TRANSCRIPTS_ENV = 'ARGO_CLAUDE_TRANSCRIPTS'

// The folder one working directory's transcripts share, named the way the Claude CLI and its SDK
// name it: every character outside [a-zA-Z0-9] becomes `-`. The CLI hashes paths over 200
// characters, which no fixture path reaches.
export function claudeProjectFolder(transcripts: string, cwd: string) {
  return path.join(transcripts, cwd.replace(/[^a-zA-Z0-9]/g, '-'))
}

// The mock writes each Session beside the fixtures, so every transcript it writes is under this root.
export function mockClaudeFolder(transcripts: string) {
  return transcripts
}
