#!/usr/bin/env node
// Stages one REAL transcript as a fresh session, so the roster opens on it rather than on whatever
// the machine happened to do today.
//
//   node perf-stage.mjs <source.jsonl> <session-folder> <minutes-ago>
//
// It copies the file under a new session id and shifts every timestamp in it forward by one
// constant, so the newest event lands `minutes-ago` before now. Nothing else changes: the rows,
// the tool calls and the media are the ones the reader complained about, at the same size. The
// shift is what puts the session at the top of a roster ordered by when it was last active.
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [source, folder, minutesAgo] = process.argv.slice(2)
const stampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g
const text = readFileSync(source, 'utf8')

let newest = 0
for (const match of text.matchAll(stampPattern)) {
  newest = Math.max(newest, Date.parse(match[0]))
}
if (newest === 0) {
  console.error(`perf-stage: ${source} carries no timestamps`)
  process.exit(1)
}

const offset = Date.now() - Number(minutesAgo) * 60_000 - newest
const target = join(folder, `${randomUUID()}.jsonl`)
writeFileSync(
  target,
  text.replace(stampPattern, (stamp) => new Date(Date.parse(stamp) + offset).toISOString()),
)
console.log(target)
