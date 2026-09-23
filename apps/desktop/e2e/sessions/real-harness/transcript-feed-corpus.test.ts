import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { assertTranscriptFeedCorpus } from './transcript-feed-corpus'

const CORPUS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'corpus')

function jsonLines(records: object[]) {
  return records.map((record) => JSON.stringify(record)).join('\n')
}

async function writeCorpus(
  roots: { claude: string; codex: string },
  claude: object[],
  codex: object[],
) {
  await Promise.all([
    writeFile(path.join(roots.claude, 'claude-session-main.jsonl'), jsonLines(claude.slice(0, 2))),
    writeFile(path.join(roots.claude, 'claude-session-task.jsonl'), jsonLines(claude.slice(2))),
    writeFile(path.join(roots.codex, 'codex-session.jsonl'), jsonLines(codex)),
  ])
}

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
  const codex = [
    {
      timestamp: '2026-09-23T12:00:00.000Z',
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'The following response_item repeats this.' },
    },
    {
      timestamp: '2026-09-23T12:00:01.000Z',
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        item: {
          type: 'UserMessage',
          id: 'codex-notice',
          content: [
            {
              type: 'text',
              text: '<task-notification><task-id>t2</task-id><status>completed</status><summary>Task finished</summary></task-notification>',
            },
          ],
        },
      },
    },
  ]
  try {
    await writeCorpus(roots, claude, codex)
    await assertTranscriptFeedCorpus({
      roots,
      sessionIds: { claude: 'claude-session', codex: 'codex-session' },
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('audits redacted transcript lines recorded from both real CLIs', async () => {
  // These lines retain real Claude Code and Codex CLI transcript shapes with private values removed.
  await assertTranscriptFeedCorpus({
    roots: { claude: CORPUS_ROOT, codex: CORPUS_ROOT },
    sessionIds: { claude: 'recorded-claude', codex: 'recorded-codex' },
    expectedEnvelopes: {
      claude: ['bash-input', 'bash-stdout', 'bash-stderr'],
      codex: ['task-notification'],
    },
    waitMs: 0,
  })
})
