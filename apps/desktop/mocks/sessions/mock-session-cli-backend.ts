// The backend every packaged Session proof runs against today: each adapter's mock CLI written
// beside the fixture tree, and both transcript roots pointed at that tree (#2308).
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import type {
  SessionCliBackend,
  SessionFixture,
  SessionReply,
} from '../../e2e/sessions/session-cli-backend'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '../../src/domains/sessions/main/proof-protocol'
import type { SessionCli } from '../../src/domains/sessions/renderer/harness/harnesses'
import { mockClaudeCli } from '../cli/claude/mock-claude-cli'
import { mockCodexCli } from '../cli/codex/mock-codex-cli'
import type { MockCli } from '../cli/mock-cli'

// Long enough for a case to read the app's wait state before the mock answers (#2119).
const SLOW_REPLY_MS = 2_000
const BUDGET_MS = 30_000
const HISTORY = { name: 'Session history' }

// Every mock this backend runs, registered once. Adding a CLI is one entry here plus its adapter.
const MOCKS: Record<SessionCli, MockCli> = { claude: mockClaudeCli, codex: mockCodexCli }

function transcriptRoots(fixture: SessionFixture): Record<SessionCli, string> {
  return { claude: fixture.claudeTranscripts, codex: fixture.codexTranscripts }
}

async function transcriptHolds(folder: string, mark: string) {
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  const records = await Promise.all(
    names.map((name) => readFile(path.join(folder, name), 'utf8').catch(() => '')),
  )
  return records.some((record) => record.includes(mark))
}

export function createMockSessionCliBackend(): SessionCliBackend {
  // Where each mock writes its transcripts, filled in by `start` before any case runs.
  const folders: Record<SessionCli, string> = { claude: '', codex: '' }
  const mark = ({ cli, prompt }: SessionReply) => MOCKS[cli].replyMark(prompt)
  const feedMark = (page: Page, reply: SessionReply) =>
    page.getByRole('region', HISTORY).getByText(mark(reply))

  return {
    name: 'mock',
    budgetMs: BUDGET_MS,
    start: async ({ root, fixture }) => {
      const roots = transcriptRoots(fixture)
      const executables = { claude: '', codex: '' }
      for (const cli of Object.keys(MOCKS) as SessionCli[]) {
        folders[cli] = MOCKS[cli].folder(roots[cli])
        executables[cli] = await MOCKS[cli].write(root, roots[cli])
      }
      return {
        executables,
        transcripts: roots,
        launchEnv: ({ slowReply, adversarialSeed }) => {
          if (adversarialSeed !== undefined) console.info(`Session mock seed: ${adversarialSeed}`)
          return {
            [SESSION_MOCK_REPLY_DELAY_MS_ENV]: String(slowReply ? SLOW_REPLY_MS : 0),
            ...(adversarialSeed === undefined
              ? {}
              : { [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: adversarialSeed }),
          }
        },
      }
    },
    waitForReply: (page, reply) => feedMark(page, reply).waitFor({ timeout: BUDGET_MS }),
    replied: async (page, reply) => (await feedMark(page, reply).count()) > 0,
    recorded: (reply) => transcriptHolds(folders[reply.cli], mark(reply)),
  }
}
