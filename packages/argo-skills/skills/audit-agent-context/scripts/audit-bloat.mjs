#!/usr/bin/env node
// Prices everything a project loads into an agent session and names the bloat in it.
// Read-only; prints a report. Usage: node audit-bloat.mjs [repo-root]
// The layout it knows is Claude Code's (.claude/, ~/.claude/); for another harness, list
// that harness's always-on sources by hand and price them the same way.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { documentChecks } from './checks.mjs'
import { kilobytes, markdownUnder, read, relativeTo, row, section, size } from './report.mjs'
import { sectionFlags } from './sections.mjs'
import { scanSkills, skillSizes } from './skills.mjs'

const root = path.resolve(process.argv[2] ?? '.')
// A linked worktree's `.git` is a file naming the main checkout's gitdir. The harness reads
// `.claude/` (settings, hooks, rules, skills, memory) from that checkout, not the worktree.
const harnessRoot = (() => {
  const dotGit = path.join(root, '.git')
  if (!existsSync(dotGit) || statSync(dotGit).isDirectory()) return root
  const match = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+?)\/\.git\/worktrees\//m)
  return match ? path.resolve(match[1]) : root
})()
const TOKENS_PER_BYTE = 1 / 2.6
const WORKING_REGION = 120_000
const relative = relativeTo(root)
const tokens = (bytes) => Math.round(bytes * TOKENS_PER_BYTE)

// --- 1. always-on sources ---
section('Always-on sources (bytes ÷ 2.6 ≈ tokens)')
const alwaysOn = new Map()
const addSource = (label, file) => {
  if (!file || !existsSync(file) || alwaysOn.has(file)) return
  alwaysOn.set(file, label)
  // An @import pastes the whole file into every request; resolve the chain transitively.
  for (const match of read(file).matchAll(/^@([^\s]+)$/gm)) {
    addSource(`import from ${relative(file)}`, path.resolve(path.dirname(file), match[1]))
  }
}
for (const name of ['CLAUDE.md', 'AGENTS.md', 'CLAUDE.local.md'])
  addSource('root', path.join(root, name))
addSource('user-global', path.join(homedir(), '.claude', 'CLAUDE.md'))
for (const file of markdownUnder(path.join(harnessRoot, '.claude', 'rules')))
  addSource('.claude/rules (auto-loaded)', file)

let settings = {}
try {
  settings = JSON.parse(read(path.join(harnessRoot, '.claude', 'settings.json')))
} catch {
  // No settings file, or one that is not JSON: there is then no output style and no hook.
}
if (settings.outputStyle) {
  const styleName = `${settings.outputStyle.toLowerCase().replace(/\s+/g, '-')}.md`
  for (const directory of [
    path.join(harnessRoot, '.claude', 'output-styles'),
    path.join(homedir(), '.claude', 'output-styles'),
  ]) {
    addSource(`output style "${settings.outputStyle}"`, path.join(directory, styleName))
  }
}
const memoryIndex = path.join(
  homedir(),
  '.claude',
  'projects',
  `-${harnessRoot.replace(/^\//, '').replace(/\//g, '-')}`,
  'memory',
  'MEMORY.md',
)
addSource('memory index', memoryIndex)

if (harnessRoot !== root) row('         ', `harness root: ${harnessRoot}`, '(linked worktree)')
let total = 0
for (const [file, label] of alwaysOn) {
  total += size(file)
  row(kilobytes(size(file)).padStart(9), relative(file), `(${label})`)
}

const { frontmatterBytes, skills } = scanSkills(harnessRoot)
total += frontmatterBytes
row(
  kilobytes(frontmatterBytes).padStart(9),
  `skill frontmatter, ${skills.length} skills`,
  '(name + description, every turn)',
)

const rules = markdownUnder(path.join(root, 'rules'))
const rulesBytes = rules.reduce((sum, file) => sum + size(file), 0)
if (rulesBytes)
  row(kilobytes(rulesBytes).padStart(9), 'rules/', '(pull: reached by pointer, not counted)')

const mcp = path.join(harnessRoot, '.mcp.json')
if (existsSync(mcp)) {
  const servers = Object.keys(JSON.parse(read(mcp)).mcpServers ?? {})
  row(
    '   ?     ',
    `.mcp.json: ${servers.length} servers (${servers.join(', ')})`,
    '(every tool schema loads; weigh by difference)',
  )
}

console.log(
  `\ntotal measurable: ${kilobytes(total)} ≈ ${tokens(total)} tokens = ${((tokens(total) / WORKING_REGION) * 100).toFixed(0)}% of a ${WORKING_REGION / 1000}k working region, re-sent every turn`,
)

// --- 2. hooks that can inject context per tool call ---
section('Hooks (a hook that prints is context on every matching call; measure one fire)')
for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
  for (const entry of entries) {
    for (const hook of entry.hooks ?? [])
      row(event.padEnd(12), (entry.matcher ?? '*').padEnd(20), hook.command ?? hook.type)
  }
}

// --- 3. per-section view of each always-on file and each rule (pull, but read whole) ---
sectionFlags({ files: [...alwaysOn.keys(), ...rules], relative })

// --- 4. skills by body and description size ---
skillSizes(skills)

// --- 5. the document checks ---
documentChecks({
  root,
  rules,
  corpus: [...alwaysOn.keys(), ...rules, ...skills.map((skill) => skill.file)],
  relative,
})
