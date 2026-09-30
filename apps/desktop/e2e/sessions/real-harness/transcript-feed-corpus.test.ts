import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertTranscriptFeedCorpus } from './transcript-feed-corpus'

const CORPUS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'corpus')

function jsonLines(records: object[]) {
  return records.map((record) => JSON.stringify(record)).join('\n')
}

const CLAUDE_RECORDS = [
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
    userType: 'external',
    sourceToolAssistantUUID: 'task-call',
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
      content: '<bash-stdout>hello</bash-stdout><bash-stderr>warning</bash-stderr>',
    },
  },
  {
    type: 'assistant',
    uuid: 'claude-agent',
    parentUuid: 'claude-bash-output',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_agent',
          name: 'Agent',
          input: { description: 'Review the Feed card', prompt: 'Read the card.' },
        },
      ],
    },
  },
  {
    type: 'user',
    uuid: 'claude-agent-notice',
    parentUuid: 'claude-agent',
    origin: { kind: 'task-notification' },
    message: {
      role: 'user',
      content:
        '<task-notification><task-id>agent-1</task-id><tool-use-id>toolu_agent</tool-use-id><status>completed</status><summary>Agent "Review the Feed card" finished</summary></task-notification>',
    },
  },
]

const CODEX_NOTICE =
  '<task-notification><task-id>t2</task-id><status>completed</status><summary>Task finished</summary></task-notification>'

function codexUserMessage(id: string, text: string) {
  return {
    timestamp: '2026-09-23T12:00:01.000Z',
    type: 'event_msg',
    payload: {
      type: 'item_completed',
      item: { type: 'UserMessage', id, content: [{ type: 'text', text }] },
    },
  }
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

test('reads Claude and Codex envelopes through their history readers into Feed rows', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-feed-corpus-'))
  const roots = { claude: path.join(root, 'claude'), codex: path.join(root, 'codex') }
  await Promise.all(Object.values(roots).map((directory) => mkdir(directory)))
  try {
    await writeCorpus(roots, CLAUDE_RECORDS, [codexUserMessage('codex-notice', CODEX_NOTICE)])
    await assertTranscriptFeedCorpus({
      roots,
      sessionIds: { claude: 'claude-session', codex: 'codex-session' },
      waitMs: 0,
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects a task notification the reader left in prose', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-feed-corpus-prose-'))
  const roots = { claude: path.join(root, 'claude'), codex: path.join(root, 'codex') }
  await Promise.all(Object.values(roots).map((directory) => mkdir(directory)))
  const notice =
    '<task-notification><task-id>t1</task-id><status>completed</status><summary>Task finished</summary></task-notification>'
  try {
    await writeCorpus(
      roots,
      [
        {
          type: 'assistant',
          uuid: 'claude-quoted',
          message: { role: 'assistant', content: [{ type: 'text', text: notice }] },
        },
      ],
      [codexUserMessage('codex-notice', notice)],
    )
    await expect(
      assertTranscriptFeedCorpus({
        roots,
        sessionIds: { claude: 'claude-session', codex: 'codex-session' },
        expectedEnvelopes: { claude: ['task-notification'], codex: ['task-notification'] },
        waitMs: 0,
      }),
    ).rejects.toThrow('claude prose holds a raw tag')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reads the recorded Claude and Codex transcript lines', async () => {
  await assertTranscriptFeedCorpus({
    roots: { claude: CORPUS_ROOT, codex: CORPUS_ROOT },
    sessionIds: { claude: 'recorded-claude', codex: 'recorded-codex' },
    expectedEnvelopes: {
      codex: ['task-notification'],
    },
    waitMs: 0,
  })
})
