import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionFeedReplySchema } from './feed-contract'
import { type SessionFeedRow, sessionFeedRowSchema } from './feed-rows'
import { toolRows } from './tool-feed'
import { groupToolRuns, TOOL_CONTENT_ROUTE } from './tool-groups'
import type { ToolCall } from './transcript'

function bash(id: string, command: string): ToolCall {
  return { id, name: 'Bash', input: { command } }
}

function edit(id: string, path: string): ToolCall {
  return { id, name: 'Edit', input: { file_path: path, old_string: 'a', new_string: 'b' } }
}

function unclassified(id: string): ToolCall {
  return { id, name: 'SomeMcpTool', input: {} }
}

function rowsFor(calls: ToolCall[]): SessionFeedRow[] {
  return toolRows(calls, new Map())
}

function prose(id: string): SessionFeedRow {
  return { shape: 'prose', id, role: 'assistant', text: 'thinking out loud' }
}

function marker(id: string): SessionFeedRow {
  return { shape: 'marker', id, marker: 'interrupted', summary: null }
}

function group(rows: SessionFeedRow[]) {
  const grouped = groupToolRuns(rows)
  assert.equal(grouped.length, 1)
  const [only] = grouped
  assert.equal(only?.shape, 'tool-group')
  return only as Extract<SessionFeedRow, { shape: 'tool-group' }>
}

test('a single command groups alone and reads "Ran a command"', () => {
  const found = group(rowsFor([bash('c1', 'bun test')]))
  assert.equal(found.label, 'Ran a command')
  assert.equal(found.calls.length, 1)
  assert.equal(found.calls[0]?.text, 'bun test')
})

test('a single unclassified tool call groups alone and reads "Called a tool"', () => {
  const found = group(rowsFor([unclassified('u1')]))
  assert.equal(found.label, 'Called a tool')
  assert.equal(found.calls.length, 1)
  assert.equal(found.calls[0]?.kind, 'tool')
})

test('several consecutive commands state the count', () => {
  const found = group(rowsFor([bash('c1', 'bun test'), bash('c2', 'bun run build')]))
  assert.equal(found.label, 'Ran 2 commands')
})

test('several consecutive file edits state the count', () => {
  const found = group(rowsFor([edit('e1', 'a.ts'), edit('e2', 'b.ts')]))
  assert.equal(found.label, 'Edited 2 files')
})

test('a mixed run states both counts in one summary', () => {
  const found = group(
    rowsFor([bash('c1', 'bun test'), bash('c2', 'bun run build'), edit('e1', 'a.ts')]),
  )
  assert.equal(found.label, 'Ran 2 commands, edited a file')
})

test('a run broken by an intervening row never merges', () => {
  for (const breaker of [prose('p1'), marker('m1')]) {
    const rows = groupToolRuns([
      ...rowsFor([bash('c1', 'bun test')]),
      breaker,
      ...rowsFor([bash('c2', 'bun run build')]),
    ])
    assert.equal(rows.length, 3)
    assert.equal(rows[0]?.shape, 'tool-group')
    assert.equal(rows[1]?.shape, breaker.shape)
    assert.equal(rows[2]?.shape, 'tool-group')
  }
})

test('a command or an unclassified tool call routes inline, and a file edit routes to the evidence panel', () => {
  assert.equal(TOOL_CONTENT_ROUTE.command, 'inline')
  assert.equal(TOOL_CONTENT_ROUTE.edited, 'evidence')
  assert.equal(TOOL_CONTENT_ROUTE.created, 'evidence')
  assert.equal(TOOL_CONTENT_ROUTE.read, 'evidence')
  assert.equal(TOOL_CONTENT_ROUTE.tool, 'inline')
})

test('a long tool run keeps its group id inside the Session feed contract', () => {
  const calls = Array.from({ length: 12 }, (_, index) =>
    bash(`123e4567-e89b-12d3-a456-426614174${String(index).padStart(3, '0')}`, 'bun test'),
  )
  const grouped = group(rowsFor(calls))

  assert.equal(grouped.id.length <= 256, true)
  assert.equal(sessionFeedRowSchema.safeParse(grouped).success, true)
  assert.equal(
    sessionFeedReplySchema.safeParse({
      version: 1,
      type: 'session.feed.read',
      requestId: 'request-1',
      sessionId: 'session-1',
      chainId: 'session-1',
      revision: 'revision-1',
      rows: [grouped],
    }).success,
    true,
  )
})
