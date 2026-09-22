// The Harness a packaged Session proof runs against (#2308). The harness owns the fixture tree, the
// packaged app copy and the launches; the backend answers the four questions that change when the
// proof swaps a mock `claude` and `codex` for the real ones.
import type { Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'

// The disk state the harness prepares for every backend.
export type SessionFixture = {
  application: string
  claudeTranscripts: string
  codexTranscripts: string
  userData: string
  project: string
  setupDocumentURL: string | undefined
}

// What one launch asks of the Harness. A slow reply is the state the wait cases read (#2119): a Harness
// that answers instantly never shows the app waiting.
export type SessionHarnessLaunch = { slowReply: boolean; adversarialSeed?: string }

// The Turn a case is waiting on, named the way the case sent it.
export type SessionReply = { harness: SessionHarness; prompt: string }

export type SessionHarnessRun = {
  // 1. Which executables the app must run.
  executables: { claude: string; codex: string }
  // 2. Which transcript roots the app must read. Null leaves it reading the machine's own.
  transcripts: { claude: string; codex: string } | null
  // What one launch adds to the app's environment.
  launchEnv: (launch: SessionHarnessLaunch) => Record<string, string>
  // Variables inherited from the developer shell that this backend must not pass to the app.
  unsetEnv?: string[]
}

export type SessionHarnessBackend = {
  readonly name: string
  // 3. The wall time one case may take, in milliseconds.
  readonly budgetMs: number
  start: (request: { root: string; fixture: SessionFixture }) => Promise<SessionHarnessRun>
  // 4. How a case waits for a reply, and what it reads to know one has not arrived yet.
  waitForReply: (page: Page, reply: SessionReply) => Promise<void>
  // Whether the Feed already shows the reply.
  replied: (page: Page, reply: SessionReply) => Promise<boolean>
  // Whether the Harness has written the reply where the app reads its transcripts.
  recorded: (reply: SessionReply) => Promise<boolean>
}
