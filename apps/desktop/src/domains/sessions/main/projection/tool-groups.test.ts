import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionFeedReplySchema } from '@/domains/sessions/contract/model/feed'
import {
  type SessionFeedRow,
  sessionFeedRowSchema,
} from '@/domains/sessions/contract/model/feed'
import { toolRows } from '@/domains/sessions/contract/model/tool'
import {
  groupToolRuns,
  TOOL_KIND_PRESENTATION,
} from '@/domains/sessions/contract/model/tool'
import type { ToolCall } from '@/domains/sessions/contract/model/transcript'
import { editCall, fetchCall, searchCall } from './tool-feed-test-fixtures'

function bash(id: string, command: string): ToolCall {
  return { id, kind: 'execute', command, label: null, text: command, background: false }
}

function unclassified(id: string): ToolCall {
  return { id, kind: 'other', label: 'Ran SomeMcpTool', text: null, source: null }
}

function execCommand(id: string, cmd: string): ToolCall {
  return { id, kind: 'execute', command: cmd, label: null, text: cmd, background: false }
}

function rowsFor(calls: ToolCall[]): SessionFeedRow[] {
  return toolRows(calls, { results: new Map(), skillBodies: new Map() })
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

test('a single unclassified tool call groups alone and reads "Ran a command"', () => {
  const found = group(rowsFor([unclassified('u1')]))
  assert.equal(found.label, 'Ran a command')
  assert.equal(found.calls.length, 1)
  assert.equal(found.calls[0]?.kind, 'tool')
})

test('several consecutive commands state the count', () => {
  const found = group(rowsFor([bash('c1', 'bun test'), bash('c2', 'bun run build')]))
  assert.equal(found.label, 'Ran 2 commands')
})

test('commands and unclassified tool calls share one count', () => {
  const found = group(rowsFor([bash('c1', 'bun test'), unclassified('u1'), unclassified('u2')]))
  assert.equal(found.label, 'Ran 3 commands')
})

test('several consecutive Codex exec calls read as commands, the same as Bash', () => {
  const found = group(rowsFor([execCommand('c1', 'bun test'), execCommand('c2', 'bun run build')]))
  assert.equal(found.label, 'Ran 2 commands')
})

test('several consecutive file edits state the count', () => {
  const found = group(rowsFor([editCall('e1', 'a.ts'), editCall('e2', 'b.ts')]))
  assert.equal(found.label, 'Edited 2 files')
})

test('a mixed run states both counts in one summary', () => {
  const found = group(
    rowsFor([bash('c1', 'bun test'), bash('c2', 'bun run build'), editCall('e1', 'a.ts')]),
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
  assert.equal(TOOL_KIND_PRESENTATION.command.route, 'inline')
  assert.equal(TOOL_KIND_PRESENTATION.edited.route, 'evidence')
  assert.equal(TOOL_KIND_PRESENTATION.created.route, 'evidence')
  assert.equal(TOOL_KIND_PRESENTATION.read.route, 'evidence')
  assert.equal(TOOL_KIND_PRESENTATION.tool.route, 'inline')
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

test('a web search reads as its query under a globe, and a fetch as its page', () => {
  const found = group(rowsFor([searchCall('w', 'argo cockpit', 'web')]))
  assert.equal(found.calls[0]?.kind, 'searched')
  assert.equal(found.calls[0]?.label, 'Searched argo cockpit')
  assert.equal(TOOL_KIND_PRESENTATION.searched.icon, 'globe')
  const url = 'https://rdap.verisign.com/com/v1/domain/argo.com'
  const fetched = group(rowsFor([fetchCall('f', url)]))
  assert.equal(fetched.calls[0]?.label, `Fetched ${url}`)
})

test('a web call that Codex reported failing carries the outcome in its title', () => {
  const call = fetchCall('f', 'https://x.test/a')
  const results = new Map([
    [
      'f',
      {
        blocks: [{ shape: 'text' as const, text: 'Internal Error ()\nL0: Failed' }],
        failed: false,
      },
    ],
  ])
  const [row] = toolRows([call], { results, skillBodies: new Map() })
  assert.equal(
    row?.shape === 'tool' ? row.label : null,
    'Fetched https://x.test/a · Internal Error',
  )
  assert.equal(row?.shape === 'tool' ? row.status : null, 'failed')
})
