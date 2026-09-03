#!/usr/bin/env node
// Prices everything a project loads into an agent session and names the bloat in it.
// Read-only; prints a report. Usage: node audit-bloat.mjs [repo-root]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { documentChecks } from './checks.mjs'
import { scanSkills } from './skills.mjs'

const root = path.resolve(process.argv[2] ?? '.')
// A linked worktree's `.git` is a file naming the main checkout's gitdir. The harness reads
// `.claude/` (settings, hooks, rules, skills, memory) from that checkout, not the worktree.
const harnessRoot = (() => {
  const dotGit = path.join(root, '.git')
  if (!existsSync(dotGit) || statSync(dotGit).isDirectory()) return root
  const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+?)\/\.git\/worktrees\//m)
  return m ? path.resolve(m[1]) : root
})()
const SKIP_DIRS = new Set(['node_modules', '.git', 'worktrees', '.build', 'build', 'dist', '.next'])
const TOKENS_PER_BYTE = 1 / 2.6
const WORKING_REGION = 120_000

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
const rel = (file) =>
  file.startsWith(root) ? path.relative(root, file) : file.replace(homedir(), '~')
const read = (file) => readFileSync(file, 'utf8')
const size = (file) => statSync(file).size
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
const tokens = (bytes) => Math.round(bytes * TOKENS_PER_BYTE)
const section = (title) => console.log(`\n## ${title}\n`)
const row = (...cells) => console.log(cells.join('  '))

// --- 1. always-on sources ---
section('Always-on sources (bytes ÷ 2.6 ≈ tokens)')
const alwaysOn = new Map()
const addSource = (label, file) => {
  if (!file || !existsSync(file) || alwaysOn.has(file)) return
  alwaysOn.set(file, label)
  // An @import pastes the whole file into every request; resolve the chain transitively.
  for (const m of read(file).matchAll(/^@([^\s]+)$/gm)) {
    addSource(`import from ${rel(file)}`, path.resolve(path.dirname(file), m[1]))
  }
}
for (const name of ['CLAUDE.md', 'AGENTS.md', 'CLAUDE.local.md'])
  addSource('root', path.join(root, name))
addSource('user-global', path.join(homedir(), '.claude', 'CLAUDE.md'))
for (const f of walk(path.join(harnessRoot, '.claude', 'rules')))
  if (f.endsWith('.md')) addSource('.claude/rules (auto-loaded)', f)

let settings = {}
try {
  settings = JSON.parse(read(path.join(harnessRoot, '.claude', 'settings.json')))
} catch {}
if (settings.outputStyle) {
  const styleName = `${settings.outputStyle.toLowerCase().replace(/\s+/g, '-')}.md`
  for (const dir of [
    path.join(harnessRoot, '.claude', 'output-styles'),
    path.join(homedir(), '.claude', 'output-styles'),
  ]) {
    addSource(`output style "${settings.outputStyle}"`, path.join(dir, styleName))
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
  row(kb(size(file)).padStart(9), rel(file), `(${label})`)
}

const { frontmatterBytes, skillBodies } = scanSkills({ root: harnessRoot, walk, read, size })
total += frontmatterBytes
row(
  kb(frontmatterBytes).padStart(9),
  `skill frontmatter, ${skillBodies.length} skills`,
  '(name + description, every turn)',
)

const rulesDir = path.join(root, 'rules')
const rulesBytes = walk(rulesDir)
  .filter((f) => f.endsWith('.md'))
  .reduce((n, f) => n + size(f), 0)
if (rulesBytes) row(kb(rulesBytes).padStart(9), 'rules/', '(pull: reached by pointer, not counted)')

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
  `\ntotal measurable: ${kb(total)} ≈ ${tokens(total)} tokens = ${((tokens(total) / WORKING_REGION) * 100).toFixed(0)}% of a ${WORKING_REGION / 1000}k working region, re-sent every turn`,
)

// --- 2. hooks that can inject context per tool call ---
section('Hooks (a hook that prints is context on every matching call; measure one fire)')
for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
  for (const entry of entries) {
    for (const hook of entry.hooks ?? [])
      row(event.padEnd(12), (entry.matcher ?? '*').padEnd(20), hook.command ?? hook.type)
  }
}

// --- 3. per-section view of each always-on file ---
section('Sections of always-on files (flags: >1.5 KB, ≥3 issue refs, >300 B of code, >5 negations)')
const sectionsOf = (text) => {
  const parts = text.split(/^(?=#{1,3} )/m)
  return parts.map((p) => ({
    heading: (p.match(/^#{1,3} (.*)$/m)?.[1] ?? '(preamble)').trim(),
    text: p,
  }))
}
const refsIn = (text) => (text.match(/(^|[\s(])#\d{2,5}\b/g) ?? []).length
const codeIn = (text) => (text.match(/```[\s\S]*?```/g) ?? []).join('').length
const negationsIn = (text) =>
  (text.match(/\b(never|do not|don't|not a|no longer)\b/gi) ?? []).length
for (const [file] of alwaysOn) {
  for (const s of sectionsOf(read(file))) {
    const bytes = s.text.length
    const flags = []
    if (bytes > 1500) flags.push('long: runbook or reference to disclose?')
    if (refsIn(s.text) >= 3) flags.push(`${refsIn(s.text)} issue refs: history as justification?`)
    if (codeIn(s.text) > 300) flags.push('code block: a cache of the environment?')
    if (negationsIn(s.text) > 5) flags.push(`${negationsIn(s.text)} negations`)
    if (flags.length) row(kb(bytes).padStart(9), `${rel(file)} › ${s.heading}`, flags.join('; '))
  }
}

// --- 4. skills by body size ---
section('Skill bodies over 8 KB (billed when they fire; disclose reference into sibling files)')
for (const s of skillBodies.filter((s) => s.bytes > 8 * 1024).sort((a, b) => b.bytes - a.bytes))
  row(kb(s.bytes).padStart(9), s.name)
section(
  'Skill descriptions over 300 bytes (always-on; front-load the trigger, one clause per branch)',
)
for (const s of skillBodies.filter((s) => s.description.length > 300))
  row(String(s.description.length).padStart(9), s.name)

const rules = walk(path.join(root, 'rules')).filter((f) => f.endsWith('.md'))
documentChecks({
  root,
  rules,
  corpus: [...alwaysOn.keys(), ...rules, ...skillBodies.map((s) => s.file)],
  refsIn,
  rel,
  row,
  section,
  walk,
})
