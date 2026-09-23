import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { assertTranscriptFeedCorpus } from './transcript-feed-corpus'

test('audits Claude and Codex transcript records through their Feed projections', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-feed-corpus-'))
  const roots = { claude: path.join(root, 'claude'), codex: path.join(root, 'codex') }
  await Promise.all(Object.values(roots).map((directory) => mkdir(directory)))
  const claude = [
    {
      type: 'user',
      uuid: 'claude-pasted',
      message: {
        role: 'user',
        content:
          'Review this: <pasted_content id="p1">const answer = 42</pasted_content id="p1"> then <pasted_content id="p2">return answer</pasted_content id="p2"> finish.',
      },
    },
    {
      type: 'user',
      uuid: 'claude-notice',
      parentUuid: 'claude-pasted',
      message: {
        role: 'user',
        content:
          '<task-notification><task-id>t1</task-id><status>completed</status><summary>Monitor event: Tests passed</summary></task-notification>',
      },
    },
    {
      type: 'user',
      uuid: 'claude-bash-input',
      parentUuid: 'claude-notice',
      message: { role: 'user', content: '<bash-input>printf hello</bash-input>' },
    },
    {
      type: 'user',
      uuid: 'claude-bash-output',
      parentUuid: 'claude-bash-input',
      message: {
        role: 'user',
        content: '<bash-stdout>hello</bash-stdout><bash-stderr></bash-stderr>',
      },
    },
  ]
  const codex = {
    timestamp: '2026-09-23T12:00:00.000Z',
    type: 'response_item',
    payload: {
      type: 'message',
      id: 'codex-notice',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: '<task-notification><task-id>t2</task-id><status>completed</status><summary>Task finished</summary></task-notification>',
        },
      ],
    },
  }
  try {
    await Promise.all([
      writeFile(
        path.join(roots.claude, 'claude-session.jsonl'),
        claude.map((line) => JSON.stringify(line)).join('\n'),
      ),
      writeFile(path.join(roots.codex, 'codex-session.jsonl'), JSON.stringify(codex)),
    ])
    await assertTranscriptFeedCorpus(roots, { claude: 'claude-session', codex: 'codex-session' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
