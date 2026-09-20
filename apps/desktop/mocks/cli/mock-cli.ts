// What the mock backend needs from one Harness adapter (#2308). Each adapter answers for its own
// mock, and the backend registers the answers rather than branching on a Harness (ADR-0024).
export type MockHarness = {
  // Writes an executable mock beside the fixture root and returns its path.
  write: (root: string, transcripts: string) => Promise<string>
  // Where that mock leaves its transcripts, under the root the fixture hands it.
  folder: (transcripts: string) => string
  // What the mock leaves in the Feed and the transcript once it has read a prompt.
  replyMark: (prompt: string) => string
}
