// The backend every packaged Session proof runs against today: each adapter's mock Harness written
// beside the fixture tree, and both transcript roots pointed at that tree (#2308).
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/domains/sessions/contract/proof-protocol'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import type {
  SessionFixture,
  SessionHarnessBackend,
  SessionReply,
} from '../../e2e/sessions/session-harness-backend'
import { mockClaudeHarness } from '../cli/claude/mock-claude-cli'
import { mockCodexHarness } from '../cli/codex/mock-codex-cli'
import type { MockHarness } from '../cli/mock-cli'

// Long enough for a case to read the app's wait state before the mock answers (#2119).
const SLOW_REPLY_MS = 2_000
const BUDGET_MS = 30_000
const HISTORY = { name: 'Session history' }

// Every mock this backend runs, registered once. Adding a Harness is one entry here plus its adapter.
const MOCKS: Record<SessionHarness, MockHarness> = {
  claude: mockClaudeHarness,
  codex: mockCodexHarness,
}

function transcriptRoots(fixture: SessionFixture): Record<SessionHarness, string> {
  return { claude: fixture.claudeTranscripts, codex: fixture.codexTranscripts }
}

async function transcriptHolds(folder: string, mark: string) {
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  const records = await Promise.all(
    names.map((name) => readFile(path.join(folder, name), 'utf8').catch(() => '')),
  )
  return records.some((record) => record.includes(mark))
}

export function createMockSessionHarnessBackend(): SessionHarnessBackend {
  // Where each mock writes its transcripts, filled in by `start` before any case runs.
  const folders: Record<SessionHarness, string> = { claude: '', codex: '' }
  const mark = ({ harness, prompt }: SessionReply) => MOCKS[harness].replyMark(prompt)
  const feedMark = (page: Page, reply: SessionReply) =>
    page.getByRole('region', HISTORY).getByText(mark(reply))

  return {
    name: 'mock',
    budgetMs: BUDGET_MS,
    start: async ({ root, fixture }) => {
      const roots = transcriptRoots(fixture)
      const executables = { claude: '', codex: '' }
      for (const harness of Object.keys(MOCKS) as SessionHarness[]) {
        folders[harness] = MOCKS[harness].folder(roots[harness])
        executables[harness] = await MOCKS[harness].write(root, roots[harness])
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
    waitForReply: (page, reply) => feedMark(page, reply).first().waitFor({ timeout: BUDGET_MS }),
    replied: async (page, reply) => (await feedMark(page, reply).count()) > 0,
    recorded: (reply) => transcriptHolds(folders[reply.harness], mark(reply)),
  }
}
