import path from 'node:path'

// The folder the mock claude writes into, under the transcript root the fixture hands it. The
// layout is the Claude adapter's (ADR-0021), so every proof reads it from here.
export function mockClaudeFolder(transcripts: string) {
  return path.join(transcripts, 'mock-claude')
}
