import { expect, test } from 'bun:test'
import { recordedSessionMessages } from '../../../mocks/cli/claude/recorded-claude-sessions'
import { recordedThread } from '../../../mocks/cli/codex/recorded-codex-threads'
import { assertVendorFeedCorpus, type VendorCorpus } from './transcript-feed-corpus'

const CODEX_NOTICE =
  '<task-notification><task-id>corpus-task</task-id><status>completed</status><summary>Task finished</summary></task-notification>'

function recordedCorpus(): VendorCorpus {
  return { claude: recordedSessionMessages(), codex: recordedThread(CODEX_NOTICE) }
}

test('projects the recorded Claude and Codex vendor reads into Feed rows', async () => {
  await assertVendorFeedCorpus(recordedCorpus(), { codex: ['task-notification'] })
})

test('rejects a task notification the decoder left in prose', async () => {
  const recorded = recordedCorpus()
  const [first] = recorded.claude
  if (first === undefined) throw new Error('The recorded Claude Session is empty.')
  const quoted = {
    ...first,
    type: 'assistant',
    uuid: 'claude-quoted',
    message: { role: 'assistant', content: [{ type: 'text', text: CODEX_NOTICE }] },
  } as typeof first
  await expect(
    assertVendorFeedCorpus(
      { ...recorded, claude: [quoted] },
      { claude: ['task-notification'], codex: ['task-notification'] },
    ),
  ).rejects.toThrow('claude prose holds a raw tag')
})
