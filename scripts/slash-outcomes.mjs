#!/usr/bin/env node
// What actually happened after a slash command was typed, read back from the CLI's own
// transcripts (#1208).
//
// A turn that ends in a question and a turn that never ran are indistinguishable from the
// composer, so `classify` names them apart: `reached` ran what the command exists to run,
// `stopped` worked and then ended without it, `silent` was never heard from at all. `stopped`
// is an upper bound — a command with a legitimate refusal scores the same as one that gave up.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TRANSCRIPT_ROOT = join(homedir(), '.claude', 'projects')

/** Worst to best, which is the order a reader wants them counted in. */
export const OUTCOMES = ['silent', 'stopped', 'reached']

/**
 * @param {string} text one transcript file
 * @returns {object[]} the records it parses to
 * @throws if a line other than the last is not JSON — that is corruption, not a live write
 */
export function parseJsonl(text) {
  const lines = text.split('\n').filter(Boolean)
  return lines.flatMap((line, index) => {
    try {
      return [JSON.parse(line)]
    } catch (err) {
      // A transcript is appended to live, so its last line can be half-written. No other can.
      if (index === lines.length - 1) return []
      throw new Error(`line ${index + 1} is not JSON: ${err.message}`)
    }
  })
}

/** The plain text of a record, with tool calls and results left out. */
export function textOf(record) {
  const content = record?.message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

// A turn ends at the next thing the person typed. Tool results and the `isMeta` record carrying
// an expanded skill body are both `type: "user"`, and neither ends a turn.
function isTyped(record) {
  if (record.type !== 'user' || record.isMeta || record.toolUseResult) return false
  const content = record?.message?.content
  return !(Array.isArray(content) && content.some((block) => block.type === 'tool_result'))
}

/**
 * Every invocation of `/<command>` in one transcript, each with the records that followed it.
 * @param {object[]} records @param {string} command without the slash
 */
export function invocationsOf(records, command) {
  const marker = `<command-name>/${command}</command-name>`
  const found = []
  for (const [index, record] of records.entries()) {
    if (record.type !== 'user' || record.isMeta || !textOf(record).includes(marker)) continue
    const turn = []
    for (let after = index + 1; after < records.length; after += 1) {
      if (isTyped(records[after])) break
      turn.push(records[after])
    }
    found.push({ index, at: record.timestamp, turn })
  }
  return found
}

/** Every shell command the model ran during a turn. */
export function bashCommands(turn) {
  return turn
    .filter((record) => record.type === 'assistant')
    .flatMap((record) => (Array.isArray(record.message?.content) ? record.message.content : []))
    .filter((block) => block.type === 'tool_use' && block.name === 'Bash')
    .map((block) => block.input?.command ?? '')
}

/**
 * @param {object[]} turn @param {RegExp} reachedPattern matches the shell command the turn was for
 * @returns {'silent'|'stopped'|'reached'}
 */
export function classify(turn, reachedPattern) {
  if (bashCommands(turn).some((command) => reachedPattern.test(command))) return 'reached'
  return turn.some((record) => record.type === 'assistant') ? 'stopped' : 'silent'
}

/** Every transcript file under `root`. */
export function transcriptFiles(root) {
  const files = []
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry)
    if (!statSync(dir).isDirectory()) continue
    for (const name of readdirSync(dir)) if (name.endsWith('.jsonl')) files.push(join(dir, name))
  }
  return files
}

/** @returns {{outcome: string, at: string, file: string, tail: string}[]} one row per invocation */
export function survey(files, command, reachedPattern) {
  const rows = []
  for (const file of files) {
    for (const { at, turn } of invocationsOf(parseJsonl(readFileSync(file, 'utf8')), command)) {
      const said = turn
        .filter((record) => record.type === 'assistant')
        .map(textOf)
        .join(' ')
        .trim()
      rows.push({
        outcome: classify(turn, reachedPattern),
        at: at ?? '',
        file,
        tail: said.slice(-200).replace(/\s+/g, ' '),
      })
    }
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at))
}

function main([command, pattern]) {
  // Both arguments are required: default either one and every invocation reports `stopped`,
  // which is the misreading this script exists to prevent.
  if (!(command && pattern)) {
    console.error("usage: node scripts/slash-outcomes.mjs <command> '<regex it should run>'")
    return 2
  }
  const rows = survey(transcriptFiles(TRANSCRIPT_ROOT), command, new RegExp(pattern))
  console.log(`/${command}: ${rows.length} invocations`)
  for (const outcome of OUTCOMES) {
    console.log(`  ${outcome.padEnd(8)} ${rows.filter((row) => row.outcome === outcome).length}`)
  }
  for (const row of rows.filter((row) => row.outcome !== 'reached')) {
    console.log(`${row.outcome.padEnd(8)} ${row.at} ${row.tail}`)
  }
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}
