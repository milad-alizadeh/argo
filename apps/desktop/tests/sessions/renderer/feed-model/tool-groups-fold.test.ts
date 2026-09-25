import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionFeedRow } from '@/domains/sessions/renderer/feed/model/feed-rows'
import { type ToolResult, toolRows } from '@/domains/sessions/renderer/feed/model/tool-feed'
import {
  foldSettledToolRuns,
  groupToolRuns,
} from '@/domains/sessions/renderer/feed/model/tool-groups'
import type { ToolCall } from '@/domains/sessions/renderer/feed/source/tool-call'
import { searchCall } from './tool-feed-test-fixtures'

function bash(id: string, command: string): ToolCall {
  return { id, kind: 'execute', command, label: null, text: command, background: false }
}

// A call with a result has settled; one without is still running.
function settledRows(calls: ToolCall[], stillRunning: string[] = []): SessionFeedRow[] {
  const results = new Map<string, ToolResult>()
  for (const call of calls)
    if (!stillRunning.includes(call.id)) results.set(call.id, { blocks: [], failed: false })
  return toolRows(calls, { results, skillBodies: new Map() })
}

test('settled runs side by side fold into one count that names no command', () => {
  const grouped = [
    ...groupToolRuns(settledRows([bash('1', 'bun test'), bash('2', 'bun run typecheck')])),
    ...groupToolRuns(settledRows([bash('3', 'bunx biome check .')])),
  ]
  const folded = foldSettledToolRuns(grouped)
  assert.equal(folded.length, 1)
  assert.equal(folded[0]?.shape === 'tool-group' ? folded[0].label : null, 'Ran 3 commands')
})

test('the running call folds into the same group as the settled ones', () => {
  const grouped = [
    ...groupToolRuns(settledRows([bash('1', 'bun test')])),
    ...groupToolRuns(settledRows([bash('2', 'bun run typecheck')], ['2'])),
  ]
  const folded = foldSettledToolRuns(grouped)
  assert.deepEqual(
    folded.map((row) => (row.shape === 'tool-group' ? row.calls.map((call) => call.status) : [])),
    [['succeeded', 'running']],
  )
})

test('a run that folds into nothing keeps its row identity', () => {
  const prose: SessionFeedRow = { shape: 'prose', id: 'p', role: 'assistant', text: 'aside' }
  const grouped = groupToolRuns([
    ...settledRows([bash('1', 'bun test')]),
    prose,
    ...settledRows([bash('2', 'bun run typecheck')]),
  ])
  const folded = foldSettledToolRuns(grouped)
  assert.deepEqual(folded, grouped)
  assert.equal(folded[0], grouped[0])
})

test('a loaded skill never folds into a neighbouring count', () => {
  const skill: ToolCall = {
    id: 's',
    kind: 'skill',
    title: 'Simple english',
  }
  const grouped = groupToolRuns(
    settledRows([bash('1', 'bun test'), skill, bash('2', 'bun run typecheck')]),
  )
  assert.equal(grouped.length, 3)
  assert.equal(foldSettledToolRuns(grouped).length, 3)
})

test('a web search counts as a command in the group it joins', () => {
  const search = searchCall('w', 'argo cockpit', 'web')
  const grouped = groupToolRuns(settledRows([bash('1', 'bun test'), search]))
  assert.equal(grouped.length, 1)
  assert.equal(grouped[0]?.shape === 'tool-group' ? grouped[0].label : null, 'Ran 2 commands')
})
