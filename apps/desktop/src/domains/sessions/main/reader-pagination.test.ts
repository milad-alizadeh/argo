// The shared Session reader's Project scoping and bounded-window pagination (#2239), split out
// of reader.test.ts to keep that file under the line cap.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { claudeSessionSource } from '@/agents/claude/sessions/read-sessions'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions'
import { ROSTER_PAGE_SIZE } from '@/domains/sessions/main/discover-transcript-sessions'
import { createSessionReader } from '@/domains/sessions/main/reader'
import {
  listed,
  tempRoot,
  writeClaudeTranscript,
  writeCodexTranscript,
} from '@/domains/sessions/main/reader-test-helpers'

// A Project's own reply only ever names its own Sessions, whatever the other Project's history
// holds (#2239): scope is applied inside each adapter's own discovery, before the reader ever
// merges the replies together.
test("scopes each CLI's reply to the requested Project rather than merging every Project's Sessions first", async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeInA',
    text: 'Hi.',
    updatedAt: '2026-09-13T09:00:00.000Z',
    cwd: '/projects/a',
  })
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeInB',
    text: 'Hi.',
    updatedAt: '2026-09-13T09:30:00.000Z',
    cwd: '/projects/b',
  })
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'codexInB',
    text: 'Hi.',
    updatedAt: '2026-09-13T09:45:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const scoped = await listed(reader, 'list-scoped', { projectRoot: '/projects/a' })
  assert.deepEqual(
    scoped?.sessions.map((session) => session.id),
    ['claudeInA'],
  )
})

test('includes a Codex Session from a linked worktree outside the Project folder', async (context) => {
  const projectRoot = await tempRoot(context)
  const linkedWorktree = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  const worktreeMetadata = path.join(projectRoot, '.git', 'worktrees', 'codex-linked')
  await mkdir(worktreeMetadata, { recursive: true })
  await writeFile(path.join(worktreeMetadata, 'gitdir'), `${path.join(linkedWorktree, '.git')}\n`)
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'codexLinked',
    text: 'Hi.',
    updatedAt: '2026-09-13T10:00:00.000Z',
    cwd: linkedWorktree,
  })
  const reader = createSessionReader([codexSessionSource(codexRoot)])

  const scoped = await listed(reader, 'list-linked', { projectRoot })

  assert.deepEqual(
    scoped?.sessions.map((session) => session.id),
    ['codexLinked'],
  )
})

test('includes the main and sibling worktrees when the selected Project is a linked worktree', async (context) => {
  const mainWorktree = await tempRoot(context)
  const selectedWorktree = await tempRoot(context)
  const siblingWorktree = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  const selectedMetadata = path.join(mainWorktree, '.git', 'worktrees', 'selected')
  const siblingMetadata = path.join(mainWorktree, '.git', 'worktrees', 'sibling')
  await mkdir(selectedMetadata, { recursive: true })
  await mkdir(siblingMetadata, { recursive: true })
  await writeFile(path.join(selectedWorktree, '.git'), `gitdir: ${selectedMetadata}\n`)
  await writeFile(path.join(selectedMetadata, 'commondir'), '../..\n')
  await writeFile(path.join(selectedMetadata, 'gitdir'), `${path.join(selectedWorktree, '.git')}\n`)
  await writeFile(path.join(siblingMetadata, 'gitdir'), `${path.join(siblingWorktree, '.git')}\n`)
  for (const [sessionId, cwd, minute] of [
    ['codexMain', mainWorktree, 0],
    ['codexSelected', selectedWorktree, 1],
    ['codexSibling', siblingWorktree, 2],
  ] as const) {
    await writeCodexTranscript({
      root: codexRoot,
      sessionId,
      text: 'Hi.',
      updatedAt: `2026-09-13T10:0${minute}:00.000Z`,
      cwd,
    })
  }
  const reader = createSessionReader([codexSessionSource(codexRoot)])

  const scoped = await listed(reader, 'list-from-linked', { projectRoot: selectedWorktree })

  assert.deepEqual(
    scoped?.sessions.map((session) => session.id),
    ['codexSibling', 'codexSelected', 'codexMain'],
  )
})

// The Roster merges every adapter's own window (#2239): the wire cursor is one opaque value, but
// it carries each adapter's own continuation independently, so growing it never disturbs an
// adapter that already read everything it has.
test('grows only the adapter with more to read when the merged cursor is echoed back', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  const claudeCount = ROSTER_PAGE_SIZE + 15
  for (let index = 0; index < claudeCount; index += 1) {
    await writeClaudeTranscript({
      root: claudeRoot,
      sessionId: `claude${index}`,
      text: 'Hi.',
      updatedAt: new Date(Date.parse('2026-09-13T00:00:00.000Z') + index * 1000).toISOString(),
    })
  }
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'codexOnly',
    text: 'Hi.',
    updatedAt: '2026-09-13T10:00:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const first = await listed(reader)
  assert.equal(first?.filesRead, ROSTER_PAGE_SIZE + 1)
  assert.notEqual(first?.nextCursor, null)

  const second = await listed(reader, 'list-2', { cursor: first?.nextCursor })
  assert.equal(second?.filesRead, claudeCount + 1)
  assert.equal(second?.nextCursor, null)
  assert.equal(second?.sessions.length, claudeCount + 1)
})
