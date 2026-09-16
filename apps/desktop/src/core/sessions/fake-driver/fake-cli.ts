// What the fake backend needs from one CLI's adapter (#2308). Each adapter answers for its own
// fake, and the backend registers the answers rather than branching on a CLI (ADR-0021).
export type FakeCli = {
  // Writes an executable fake beside the fixture root and returns its path.
  write: (root: string, transcripts: string) => Promise<string>
  // Where that fake leaves its transcripts, under the root the fixture hands it.
  folder: (transcripts: string) => string
  // What the fake leaves in the Feed and the transcript once it has read a prompt.
  replyMark: (prompt: string) => string
}
