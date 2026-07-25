#!/usr/bin/env node
/**
 * File-length gate: fails when a source file exceeds the cap.
 *
 * Most linters cap function length, not file length, so this covers the
 * extract-before-you-dump rule mechanically. Copy verbatim; configure via argv.
 *
 *   node scripts/file-length-check.mjs --max 150 "src/**\/*.{ts,tsx}"
 *
 * Flags:
 *   --max <n>            line cap (default 150)
 *   --exempt <glob>      repeatable; files matching are skipped
 *   --exempt-from <file> read exempt globs from a file, one per line, `#` comments allowed —
 *                        this is where each exemption states its reason
 *   --blank              count blank lines too (default: skipped)
 */
import { glob, readFile } from 'node:fs/promises'

const VALUED_FLAGS = new Set(['max', 'exempt', 'exempt-from'])

const argv = process.argv.slice(2)
const patterns = []
const exemptions = []
const exemptionFiles = []
let max = 150
let countBlank = false

for (let at = 0; at < argv.length; at++) {
  const arg = argv[at]
  const name = arg.startsWith('--') ? arg.slice(2) : null
  switch (name) {
    case null:
      patterns.push(arg)
      break
    case 'blank':
      countBlank = true
      break
    case 'max':
      max = Number(argv[++at])
      break
    case 'exempt':
      exemptions.push(argv[++at])
      break
    case 'exempt-from':
      exemptionFiles.push(argv[++at])
      break
    default:
      console.error(`file-length-check: unknown flag ${arg}`)
      process.exit(2)
  }
  if (name && VALUED_FLAGS.has(name) && argv[at] === undefined) {
    console.error(`file-length-check: ${arg} needs a value`)
    process.exit(2)
  }
}

if (patterns.length === 0) {
  console.error('file-length-check: no source globs given')
  process.exit(2)
}

for (const file of exemptionFiles) {
  const lines = (await readFile(file, 'utf8')).split('\n')
  for (const line of lines) {
    const pattern = line.replace(/#.*$/, '').trim()
    if (pattern !== '') exemptions.push(pattern)
  }
}

const exempted = new Set()
for (const pattern of exemptions) {
  for await (const path of glob(pattern)) exempted.add(path)
}

const overCap = []
for (const pattern of patterns) {
  for await (const path of glob(pattern)) {
    if (exempted.has(path)) continue
    const source = await readFile(path, 'utf8')
    const lines = source.split('\n').filter((line) => countBlank || line.trim() !== '')
    if (lines.length > max) overCap.push({ path, lines: lines.length })
  }
}

if (overCap.length === 0) {
  process.exit(0)
}

overCap.sort((a, b) => b.lines - a.lines)
console.error(`file-length-check: ${overCap.length} file(s) over ${max} lines\n`)
for (const { path, lines } of overCap) {
  console.error(`  ${lines.toString().padStart(5)}  ${path}`)
}
console.error('\nSplit the file into a folder of focused units (see rules/file-structure.md).')
process.exit(1)
