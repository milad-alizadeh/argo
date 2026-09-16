// The backend every packaged Session proof runs against today: each adapter's fake CLI written
// beside the fixture tree, and both transcript roots pointed at that tree (#2308).
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import { fakeClaudeCli } from '../../../agents/claude/session-fake-driver/fake-claude-cli'
import { fakeCodexCli } from '../../../agents/codex/session-fake-driver/fake-codex-cli'
import type { SessionCli } from '../../../renderer/modules/sessions/harness/harnesses'
import { SESSION_FAKE_REPLY_DELAY_MS_ENV } from '../proof-protocol'
import type { FakeCli } from './fake-cli'
import type { SessionCliBackend, SessionFixture, SessionReply } from './session-cli-backend'

// Long enough for a case to read the app's wait state before the fake answers (#2119).
const SLOW_REPLY_MS = 2_000
const BUDGET_MS = 30_000
const HISTORY = { name: 'Session history' }

// Every fake this backend runs, registered once. Adding a CLI is one entry here plus its adapter.
const FAKES: Record<SessionCli, FakeCli> = { claude: fakeClaudeCli, codex: fakeCodexCli }

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

export function createFakeSessionCliBackend(): SessionCliBackend {
  // Where each fake writes its transcripts, filled in by `start` before any case runs.
  const folders: Record<SessionCli, string> = { claude: '', codex: '' }
  const mark = ({ cli, prompt }: SessionReply) => FAKES[cli].replyMark(prompt)
  const feedMark = (page: Page, reply: SessionReply) =>
    page.getByRole('region', HISTORY).getByText(mark(reply))

  return {
    name: 'fake',
    budgetMs: BUDGET_MS,
    start: async ({ root, fixture }) => {
      const roots = transcriptRoots(fixture)
      const executables = { claude: '', codex: '' }
      for (const cli of Object.keys(FAKES) as SessionCli[]) {
        folders[cli] = FAKES[cli].folder(roots[cli])
        executables[cli] = await FAKES[cli].write(root, roots[cli])
      }
      return {
        executables,
        transcripts: { ...roots, archive: fixture.archive },
        launchEnv: ({ slowReply }) => ({
          [SESSION_FAKE_REPLY_DELAY_MS_ENV]: String(slowReply ? SLOW_REPLY_MS : 0),
        }),
      }
    },
    waitForReply: (page, reply) => feedMark(page, reply).waitFor({ timeout: BUDGET_MS }),
    replied: async (page, reply) => (await feedMark(page, reply).count()) > 0,
    recorded: (reply) => transcriptHolds(folders[reply.cli], mark(reply)),
  }
}
