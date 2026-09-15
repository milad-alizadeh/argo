import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compactionHookCommand } from '../compaction/compaction-hook.ts'
import { parseTranscriptLine } from '../sessions/records.ts'

function commandOutput(stdout: string) {
  const read = parseTranscriptLine(
    JSON.stringify({
      type: 'user',
      uuid: 'u-stdout',
      message: { role: 'user', content: `<local-command-stdout>${stdout}</local-command-stdout>` },
    }),
  )
  return read.kind === 'command-output' ? read.text : read.kind
}

// The record Claude Code 2.1.272 wrote after a `/compact` with Argo's hook installed.
test('reads /compact output without terminal colours or the report of Argo’s own hook', () => {
  const hook = compactionHookCommand('/home/person/.claude/argo-compactions')
  const stdout = `[2mCompacted (ctrl+o to see full summary)[22m\n[2mPreCompact [${hook}] completed successfully[22m`
  assert.equal(commandOutput(stdout), 'Compacted (ctrl+o to see full summary)')
})

test('keeps the report of a hook the person installed', () => {
  const stdout = 'Compacted\nPreCompact [./my-hook.sh] completed successfully'
  assert.equal(commandOutput(stdout), stdout)
})

test('reads output that is only Argo’s hook report as nothing to show', () => {
  const hook = compactionHookCommand('/home/person/.claude/argo-compactions')
  assert.equal(commandOutput(`PreCompact [${hook}] completed successfully`), 'trace')
})
