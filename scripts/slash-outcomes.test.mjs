#!/usr/bin/env node
// Tests the transcript reader behind #1208, run via `bun run test:hooks`.
//
// The trap each case pins is the one that made the first reading of #1208 wrong: a `/ship` turn
// is four record types deep before the model says anything, and treating the wrong one as the end
// of the turn reports every invocation as silent — which reads as "the command does nothing" and
// sends the next session after the skill's frontmatter instead of its prose.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, report } from './check-harness.mjs'
import {
  bashCommands,
  classify,
  invocationsOf,
  parseJsonl,
  survey,
  textOf,
  transcriptFiles,
} from './slash-outcomes.mjs'

const typed = (text, at = '2026-09-04T00:00:00Z') => ({
  type: 'user',
  timestamp: at,
  message: { content: text },
})
const expanded = (body) => ({
  type: 'user',
  isMeta: true,
  message: { content: [{ type: 'text', text: body }] },
})
const said = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
const ran = (command) => ({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] },
})
const toolResult = () => ({
  type: 'user',
  message: { content: [{ type: 'tool_result', content: 'ok' }] },
})
const invoke = (name) =>
  typed(`<command-message>${name}</command-message>\n<command-name>/${name}</command-name>`)

const OPENS_A_PR = /gh pr create/

check('finds a slash invocation and not the skill body it expands to', () => {
  const found = invocationsOf([invoke('ship'), expanded('# Ship\n/ship is documented')], 'ship')
  assert.equal(found.length, 1)
  assert.equal(found[0].index, 0)
})

check('the expanded body does not end the turn', () => {
  const records = [invoke('ship'), expanded('# Ship'), ran('gh pr create --fill')]
  assert.equal(classify(invocationsOf(records, 'ship')[0].turn, OPENS_A_PR), 'reached')
})

check('a tool result does not end the turn', () => {
  const records = [
    invoke('ship'),
    ran('git push -u origin HEAD'),
    toolResult(),
    ran('gh pr create'),
  ]
  assert.equal(classify(invocationsOf(records, 'ship')[0].turn, OPENS_A_PR), 'reached')
})

check('the next thing the person typed does end the turn', () => {
  const records = [
    invoke('ship'),
    said('which do you want?'),
    typed('the first'),
    ran('gh pr create'),
  ]
  const [{ turn }] = invocationsOf(records, 'ship')
  assert.deepEqual(bashCommands(turn), [])
  assert.equal(classify(turn, OPENS_A_PR), 'stopped')
})

check('a turn that worked and then asked instead of shipping is `stopped`, not `silent`', () => {
  const records = [
    invoke('ship'),
    ran('git status'),
    toolResult(),
    said('no review ran — say the word'),
  ]
  assert.equal(classify(invocationsOf(records, 'ship')[0].turn, OPENS_A_PR), 'stopped')
})

check('a turn the model never reached at all is `silent`', () => {
  const [{ turn }] = invocationsOf([invoke('ship'), expanded('# Ship')], 'ship')
  assert.equal(classify(turn, OPENS_A_PR), 'silent')
})

check('one command does not match another whose name it prefixes', () => {
  assert.deepEqual(invocationsOf([invoke('ship-it')], 'ship'), [])
})

check('a half-written last line is skipped, not thrown', () => {
  assert.deepEqual(parseJsonl('{"type":"user"}\n{"type":"assis'), [{ type: 'user' }])
})

check('a malformed line anywhere else is corruption, and says so', () => {
  assert.throws(() => parseJsonl('{"type":"assis\n{"type":"user"}'), /line 1 is not JSON/)
})

check('survey reads a tree of transcripts and counts each invocation once', () => {
  const root = mkdtempSync(join(tmpdir(), 'slash-outcomes-'))
  const project = join(root, 'a-project')
  mkdirSync(project)
  const jsonl = (records) => `${records.map((record) => JSON.stringify(record)).join('\n')}\n`
  writeFileSync(join(project, 'one.jsonl'), jsonl([invoke('ship'), ran('gh pr create')]))
  writeFileSync(join(project, 'two.jsonl'), jsonl([invoke('ship'), said('which do you want?')]))
  writeFileSync(join(project, 'notes.md'), 'not a transcript')

  assert.equal(transcriptFiles(root).length, 2)
  const rows = survey(transcriptFiles(root), 'ship', OPENS_A_PR)
  assert.deepEqual(rows.map((row) => row.outcome).sort(), ['reached', 'stopped'])
  assert.equal(rows.find((row) => row.outcome === 'stopped').tail, 'which do you want?')
  rmSync(root, { recursive: true })
})

check('text reads through a content array and ignores tool calls', () => {
  assert.equal(textOf(ran('git push')), '')
  assert.equal(textOf(said('done')), 'done')
})

report('slash-outcomes')
