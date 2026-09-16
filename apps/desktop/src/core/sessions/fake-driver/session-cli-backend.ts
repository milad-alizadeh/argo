// The CLI a packaged Session proof runs against (#2308). The harness owns the fixture tree, the
// packaged app copy and the launches; the backend answers the four questions that change when the
// proof swaps a fake `claude` and `codex` for the real ones.
import type { Page } from 'playwright-core'
import type { SessionCli } from '../../../renderer/modules/sessions/harness/harnesses'

// The disk state the harness prepares for every backend.
export type SessionFixture = {
  application: string
  claudeTranscripts: string
  codexTranscripts: string
  archive: string
  userData: string
  project: string
}

// What one launch asks of the CLI. A slow reply is the state the wait cases read (#2119): a CLI
// that answers instantly never shows the app waiting.
export type SessionCliLaunch = { slowReply: boolean; adversarialSeed?: string }

// The Turn a case is waiting on, named the way the case sent it.
export type SessionReply = { cli: SessionCli; prompt: string }

export type SessionCliRun = {
  // 1. Which executables the app must run.
  executables: { claude: string; codex: string }
  // 2. Which transcript roots the app must read. Null leaves it reading the machine's own.
  transcripts: { claude: string; codex: string; archive: string } | null
  // What one launch adds to the app's environment.
  launchEnv: (launch: SessionCliLaunch) => Record<string, string>
}

export type SessionCliBackend = {
  readonly name: string
  // 3. The wall time one case may take, in milliseconds.
  readonly budgetMs: number
  start: (request: { root: string; fixture: SessionFixture }) => Promise<SessionCliRun>
  // 4. How a case waits for a reply, and what it reads to know one has not arrived yet.
  waitForReply: (page: Page, reply: SessionReply) => Promise<void>
  // Whether the Feed already shows the reply.
  replied: (page: Page, reply: SessionReply) => Promise<boolean>
  // Whether the CLI has written the reply where the app reads its transcripts.
  recorded: (reply: SessionReply) => Promise<boolean>
}
