import { expect, test } from 'bun:test'
import { feedEntryRows, projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import { decodeClaudeSessionMessages } from '@/harnesses/claude/session/claude-session-history'
import { recordedSession } from '../../../mocks/cli/claude/recorded-claude-sessions'
import { recordedThread } from '../../../mocks/cli/codex/recorded-codex-threads'
import { RECORDED_PROMPTS } from '../../../mocks/cli/recorded-prompts'
import { assertVendorFeedCorpus, type VendorCorpus } from './vendor-feed-corpus'

const { claudeToolCalls, codexNotice } = RECORDED_PROMPTS

function recordedCorpus(): VendorCorpus {
  return { claude: recordedSession(claudeToolCalls), codex: recordedThread(codexNotice) }
}

test('projects the recorded Claude and Codex vendor reads into Feed rows', async () => {
  // A headless Claude run writes none of the raw-tag shapes; the decoder's envelope tests cover them.
  await assertVendorFeedCorpus(recordedCorpus(), { claude: [], codex: ['task-notification'] })
})

// The calls the model chose vary by recording, so only their grouping is fixed.
test('groups the recorded Claude tool calls into one tool row between the prose', () => {
  const content = decodeClaudeSessionMessages(recordedSession(claudeToolCalls))
  const rows = feedEntryRows(projectFeedRowEntries({ history: content, live: [] }).entries)
  expect(rows.map((row) => row.shape)).toEqual(['prose', 'tool-group', 'prose'])
  const kinds = rows
    .flatMap((row) => (row.shape === 'tool-group' ? row.calls : []))
    .map((call) => call.kind)
  expect(kinds).toEqual(expect.arrayContaining(['command', 'edited']))
})

test('rejects a task notification the decoder left in prose', async () => {
  const recorded = recordedCorpus()
  const [first] = recorded.claude
  if (first === undefined) throw new Error('The recorded Claude Session is empty.')
  const quoted = {
    ...first,
    type: 'assistant',
    uuid: 'claude-quoted',
    message: { role: 'assistant', content: [{ type: 'text', text: codexNotice }] },
  } as typeof first
  await expect(
    assertVendorFeedCorpus(
      { ...recorded, claude: [quoted] },
      { claude: ['task-notification'], codex: ['task-notification'] },
    ),
  ).rejects.toThrow('claude prose holds a raw tag')
})
