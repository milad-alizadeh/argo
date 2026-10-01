// The backend every packaged Session proof runs against today: each adapter's mock Harness written
// beside the fixture tree, and both transcript roots pointed at that tree (#2308).
import type { Page } from 'playwright-core'
import type { Harness } from '@/domains/sessions/renderer/harness/harnesses'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/harnesses/proof-protocol'
import type {
  SessionFixture,
  SessionHarnessBackend,
  SessionReply,
} from '../../e2e/sessions/session-harness-backend'
import { mockClaudeHarness } from '../cli/claude/mock-claude-cli'
import { mockClaudeAcpHarness } from '../cli/claude-acp/mock-claude-acp-cli'
import { mockClaudeAcpRoot } from '../cli/claude-acp/mock-claude-acp-transcripts'
import { mockCodexHarness } from '../cli/codex/mock-codex-cli'
import type { MockHarness } from '../cli/mock-cli'
import { signedInHarnessEnvironment } from '../cli/signed-in-harness'

// Long enough for a case to read the app's wait state before the mock answers (#2119).
const SLOW_REPLY_MS = 2_000
const BUDGET_MS = 30_000
const HISTORY = { name: 'Session history' }

// Every mock this backend runs, registered once. Adding a Harness is one entry here plus its adapter.
const MOCKS: Record<Harness, MockHarness> = {
  claude: mockClaudeHarness,
  codex: mockCodexHarness,
  'claude-acp': mockClaudeAcpHarness,
}

function transcriptRoots(root: string, fixture: SessionFixture): Record<Harness, string> {
  return {
    claude: fixture.claudeTranscripts,
    codex: fixture.codexTranscripts,
    'claude-acp': mockClaudeAcpRoot(root),
  }
}

export function createMockSessionHarnessBackend(): SessionHarnessBackend {
  // The proof root and each mock's transcript root, filled in by `start` before any case runs.
  let proofRoot = ''
  let roots: Record<Harness, string> = { claude: '', codex: '', 'claude-acp': '' }
  const mark = ({ harness, prompt }: SessionReply) => MOCKS[harness].replyMark(prompt)
  const feedMark = (page: Page, reply: SessionReply) =>
    page.getByRole('region', HISTORY).getByText(mark(reply))

  return {
    name: 'mock',
    budgetMs: BUDGET_MS,
    start: async ({ root, fixture }) => {
      proofRoot = root
      roots = transcriptRoots(root, fixture)
      const executables: Record<Harness, string> = {
        claude: '',
        codex: '',
        'claude-acp': '',
      }
      for (const harness of Object.keys(MOCKS) as Harness[]) {
        executables[harness] = await MOCKS[harness].write(root, roots[harness])
      }
      const signedIn = await signedInHarnessEnvironment(root)
      return {
        executables,
        transcripts: { claude: roots.claude, codex: roots.codex },
        launchEnv: ({ slowReply, adversarialSeed }) => {
          if (adversarialSeed !== undefined) console.info(`Session mock seed: ${adversarialSeed}`)
          return {
            ...signedIn,
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
    recorded: (reply) =>
      MOCKS[reply.harness].recorded(proofRoot, roots[reply.harness], mark(reply)),
  }
}
