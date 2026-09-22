import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compactionHookCommand } from '../compaction/compaction-hook'
import { parseTranscriptLine } from '../sessions/records/records'

const ESCAPE = String.fromCharCode(27)
const dim = (text: string) => `${ESCAPE}[2m${text}${ESCAPE}[22m`

function userRecord(content: string) {
  return parseTranscriptLine(
    JSON.stringify({ type: 'user', uuid: 'u-stdout', message: { role: 'user', content } }),
  )
}

function commandOutput(stdout: string) {
  const read = userRecord(`<local-command-stdout>${stdout}</local-command-stdout>`)
  return read.kind === 'command-output' ? read.text : read.kind
}

// The records Claude Code 2.1.273 wrote after the boundary of a `/compact`: an echo of the command
// the Feed already shows as a prompt, and a report the compaction divider already makes.
test('reads the /compact echo after the boundary as nothing to show', () => {
  const hook = compactionHookCommand('/home/person/.claude/argo-compactions')
  const echo =
    '<command-name>/compact</command-name>\n            <command-message>compact</command-message>\n            <command-args></command-args>'
  assert.equal(userRecord(echo).kind, 'trace')
  const stdout = `${dim('Compacted (ctrl+o to see full summary)')}\n${dim(`PreCompact [${hook}] completed successfully`)}`
  assert.equal(commandOutput(stdout), 'trace')
})

test('keeps the report of a hook the person installed', () => {
  const report = 'PreCompact [./my-hook.sh] completed successfully'
  assert.equal(commandOutput(`Compacted (ctrl+o to see full summary)\n${report}`), report)
})

test('reads command output without terminal colours', () => {
  assert.equal(commandOutput(dim('Set effort level to medium')), 'Set effort level to medium')
})
