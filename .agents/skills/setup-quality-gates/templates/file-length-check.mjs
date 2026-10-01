#!/usr/bin/env node
/**
 * File-length gate: fails when a source file exceeds the cap.
 *
 * Most linters cap function length, not file length, so this covers the
 * extract-before-you-dump rule mechanically. Copy verbatim; configure via argv.
 *
 *   node scripts/file-length-check.mjs --max 150 \
 *     --exempt-from scripts/file-length-exempt.txt "src/**\/*.{ts,tsx}"
 *
 * Flags:
 *   --max <n>            line cap, required, a positive integer
 *   --exempt-from <file> globs to skip, one per line, `#` comments allowed — the comment is
 *                        where each exemption states its reason. Repeatable.
 *
 * Blank lines never count. Exits 0 clean, 1 on a breach, 2 on bad usage — a
 * misconfigured gate must never read as a pass.
 */
import { glob, readFile } from 'node:fs/promises'

const usage = (problem) => {
  console.error(`file-length-check: ${problem}`)
  console.error('usage: file-length-check --max <n> [--exempt-from <file>] <glob>...')
  process.exit(2)
}

const argv = process.argv.slice(2)
const patterns = []
const exemptionFiles = []
let max

for (let at = 0; at < argv.length; at++) {
  const arg = argv[at]
  if (!arg.startsWith('--')) {
    patterns.push(arg)
    continue
  }
  const name = arg.slice(2)
  const value = argv[++at]
  if (value === undefined || value.startsWith('--')) usage(`${arg} needs a value`)
  switch (name) {
    case 'max':
      max = Number(value)
      if (!Number.isInteger(max) || max < 1) usage(`--max needs a positive integer, got "${value}"`)
      break
    case 'exempt-from':
      exemptionFiles.push(value)
      break
    default:
      usage(`unknown flag ${arg}`)
  }
}

if (max === undefined) usage('--max is required')
if (patterns.length === 0) usage('no source globs given')

const exemptions = []
for (const file of exemptionFiles) {
  const contents = await readFile(file, 'utf8').catch(() => usage(`cannot read ${file}`))
  for (const line of contents.split('\n')) {
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
    const lines = source.split('\n').filter((line) => line.trim() !== '')
    if (lines.length > max) overCap.push({ path, lines: lines.length })
  }
}

if (overCap.length === 0) process.exit(0)

overCap.sort((a, b) => b.lines - a.lines)
console.error(`file-length-check: ${overCap.length} file(s) over ${max} lines\n`)
for (const { path, lines } of overCap) {
  console.error(`  ${lines.toString().padStart(5)}  ${path}`)
}
console.error('\nSplit each into a folder of focused units, or exempt it with a stated reason.')
process.exit(1)
