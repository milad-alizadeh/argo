// The backend every packaged Session proof runs against today: two fake CLIs written beside the
// fixture tree, and both transcript roots pointed at that tree (#2308).
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import { fakeClaudeFolder } from '../../../agents/claude/session-fake-driver/fake-claude-transcripts'
import { writeFakeClaude } from '../../../agents/claude/session-fake-driver/session-resume-case'
import { writeFakeCodex } from '../../../agents/codex/session-fake-driver/fixture-driver'
import { SESSION_FAKE_REPLY_DELAY_MS_ENV } from '../proof-protocol'
import type { SessionCliBackend, SessionReply } from './session-cli-backend'

// Long enough for a case to read the app's wait state before the fake answers (#2119).
const SLOW_REPLY_MS = 2_000
const BUDGET_MS = 30_000
const HISTORY = { name: 'Session history' }

// What the fake CLIs leave behind for a prompt. The fake `claude` answers in words; the fake
// Codex app-server completes the Turn without a message of its own, so the mark a Codex case
// waits for is the prompt the Turn carried.
function replyMark({ cli, prompt }: SessionReply) {
  return cli === 'claude' ? `Fake Claude read: ${prompt}` : prompt
}

async function transcriptHolds(folder: string, mark: string) {
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  const records = await Promise.all(
    names.map((name) => readFile(path.join(folder, name), 'utf8').catch(() => '')),
  )
  return records.some((record) => record.includes(mark))
}

export function createFakeSessionCliBackend(): SessionCliBackend {
  // The folder each CLI's fake writes into, filled in by `start` before any case runs.
  const written: Record<SessionReply['cli'], string> = { claude: '', codex: '' }
  const feedMark = (page: Page, reply: SessionReply) =>
    page.getByRole('region', HISTORY).getByText(replyMark(reply))

  return {
    name: 'fake',
    budgetMs: BUDGET_MS,
    start: async ({ root, fixture }) => {
      written.claude = fakeClaudeFolder(fixture.claudeTranscripts)
      written.codex = fixture.codexTranscripts
      return {
        executables: {
          claude: await writeFakeClaude(root, fixture.claudeTranscripts),
          codex: await writeFakeCodex(root),
        },
        transcripts: {
          claude: fixture.claudeTranscripts,
          codex: fixture.codexTranscripts,
          archive: fixture.archive,
        },
        launchEnv: ({ slowReply }) => ({
          [SESSION_FAKE_REPLY_DELAY_MS_ENV]: String(slowReply ? SLOW_REPLY_MS : 0),
        }),
      }
    },
    waitForReply: (page, reply) => feedMark(page, reply).waitFor({ timeout: BUDGET_MS }),
    replied: async (page, reply) => (await feedMark(page, reply).count()) > 0,
    recorded: (reply) => transcriptHolds(written[reply.cli], replyMark(reply)),
  }
}
