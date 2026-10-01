import { expect, test } from 'bun:test'
import { recordedSession } from '../../../mocks/cli/claude/recorded-claude-sessions'
import { recordedThread } from '../../../mocks/cli/codex/recorded-codex-threads'
import { assertVendorFeedCorpus, type VendorCorpus } from './transcript-feed-corpus'

const CLAUDE_TOOL_CALLS =
  'Run the composer check: run the shell command echo argo-recorded with the Bash tool, then edit notes.txt to replace old with new. Reply with one short sentence.'
const CODEX_NOTICE =
  '<task-notification><task-id>corpus-task</task-id><status>completed</status><summary>Task finished</summary></task-notification>'

function recordedCorpus(): VendorCorpus {
  return { claude: recordedSession(CLAUDE_TOOL_CALLS), codex: recordedThread(CODEX_NOTICE) }
}

test('projects the recorded Claude and Codex vendor reads into Feed rows', async () => {
  // A headless Claude run writes none of the raw-tag shapes; the decoder's envelope tests cover them.
  await assertVendorFeedCorpus(recordedCorpus(), { claude: [], codex: ['task-notification'] })
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
