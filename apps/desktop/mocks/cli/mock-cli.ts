// A Session started in a folder of this name fails before the mock CLI names it (#3013).
export const MOCK_START_REFUSED_FOLDER = 'mock-start-refused'

// What the mock backend needs from one Harness adapter (#2308). Each adapter answers for its own
// mock, and the backend registers the answers rather than branching on a Harness (ADR-0024).
export type MockHarness = {
  // Writes an executable mock beside the fixture root and returns its path.
  write: (root: string, transcripts: string) => Promise<string>
  // What the mock leaves in the Feed and its history once it has read a prompt.
  replyMark: (prompt: string) => string
  // Whether that mark is in the mock's history, read the way the Harness's own reader reads it.
  recorded: (root: string, transcripts: string, mark: string) => Promise<boolean>
}
