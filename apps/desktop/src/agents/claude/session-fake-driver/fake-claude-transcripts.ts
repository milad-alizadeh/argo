import path from 'node:path'

// The folder the fake claude writes into, under the transcript root the fixture hands it. The
// layout is the Claude adapter's (ADR-0021), so every proof reads it from here.
export function fakeClaudeFolder(transcripts: string) {
  return path.join(transcripts, 'fake-claude')
}
