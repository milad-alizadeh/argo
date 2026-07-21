#!/usr/bin/env node
// argo-skill-starter — install a bundle of agent skills (third-party + your own)
// into the current project with one command. A thin resolver over `npx skills add`.

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRoot, sync as syncHooks } from './hooks-sync.mjs'

const STARTER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// The Argo checkout root (STARTER_DIR is <root>/packages/argo-skills). `npx github:…`
// clones the whole repo, so the guardrail-hook assets sit here at install time.
const SOURCE_ROOT = resolve(STARTER_DIR, '..', '..')
// The full guardrail set copied into every target: the neutral descriptor, the two
// scripts its projected commands invoke, and the worktree contract the edit-guard's
// deny message cites (so the rules land with the enforcement). Lockstep with hooks.json.
const HOOK_ASSETS = [
  'hooks.json',
  'scripts/worktree-guard.mjs',
  'scripts/worktree-gc.sh',
  'docs/agents/worktrees.md',
]

// Copy the guardrail-hook assets from the Argo checkout into the target project, then
// project the descriptor into each agent's config. Target is the git root, not the cwd:
// the projected commands resolve scripts via `git rev-parse --show-toplevel`, so a run
// from a subdirectory must still land the assets at the repo root. Skipped when
// installing into Argo itself (source === target), and a no-op when the assets aren't in
// this install (e.g. an npm-published, skills-only package) so it degrades gracefully.
function installHooks(cwd, agents, dryRun) {
  const target = gitRoot(cwd)
  if (realpathSync(SOURCE_ROOT) !== realpathSync(target)) {
    const missing = HOOK_ASSETS.filter((rel) => !existsSync(resolve(SOURCE_ROOT, rel)))
    if (missing.length) {
      console.log(
        `\n⚠ hook assets absent from this install (${missing.join(', ')}) — skipping hook setup`,
      )
      return
    }
    console.log('\ncopying guardrail-hook assets:')
    for (const rel of HOOK_ASSETS) {
      console.log(`  ${dryRun ? 'would copy' : 'copied'} ${rel}`)
      if (!dryRun) {
        mkdirSync(dirname(resolve(target, rel)), { recursive: true })
        copyFileSync(resolve(SOURCE_ROOT, rel), resolve(target, rel))
      }
    }
  }

  // Real run leaves hooks.json at the target; a dry run hasn't copied it, so read source.
  const descriptorPath = existsSync(resolve(target, 'hooks.json'))
    ? resolve(target, 'hooks.json')
    : resolve(SOURCE_ROOT, 'hooks.json')
  console.log('\nprojecting hooks per-agent:')
  syncHooks({
    root: target,
    descriptor: JSON.parse(readFileSync(descriptorPath, 'utf8')),
    agents,
    dryRun,
  })
}

const argv = process.argv.slice(2)
const has = (...flags) => flags.some((f) => argv.includes(f))
const dryRun = has('--dry-run', '-n')
const globalOverride = has('--global', '-g')
const projectOverride = has('--project', '-p')
// Guardrail hooks are opt-in: they impose Argo's worktree discipline (apps/+packages/
// edit guard, worktree reaper) on the project, so a consumer chooses them explicitly.
const wantHooks = has('--hooks') && !has('--no-hooks')

function loadConfig() {
  const path = resolve(STARTER_DIR, 'bundle.json')
  try {
    return { path, cfg: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (err) {
    console.error(`✗ Could not read bundle.json at ${path}\n  ${err.message}`)
    process.exit(1)
  }
}

// A local "./skills" source must be an absolute path so it resolves from any cwd.
function resolveSource(source) {
  if (source.startsWith('.') || source.startsWith('/')) {
    return isAbsolute(source) ? source : resolve(STARTER_DIR, source)
  }
  return source // owner/repo, URL, or git spec — passed through to `skills add`
}

function buildArgs(entry, agents, scope) {
  const skills = entry.skills ?? '*'
  const exclude = new Set([].concat(entry.exclude ?? []))
  const agentList = entry.agents ?? agents
  const args = ['--yes', 'skills', 'add', resolveSource(entry.source)]
  const named = skills === '*' ? ['*'] : [].concat(skills).filter((s) => !exclude.has(s))
  args.push('--skill', ...named)
  if (agentList?.length) args.push('--agent', ...agentList)
  if (scope === 'global') args.push('--global')
  args.push('--yes')
  return args
}

// `skills add` has no exclusion syntax, so with skills:"*" an exclude is applied
// by removing the skill right after the source installs. A later entry may then
// install its own skill under the excluded name (how Argo's implement fork
// overrides upstream) — so any overriding source must come after this one.
function buildRemoveArgs(name, entry, agents, scope) {
  const agentList = entry.agents ?? agents
  const args = ['--yes', 'skills', 'remove', name]
  if (agentList?.length) args.push('--agent', ...agentList)
  if (scope === 'global') args.push('--global')
  args.push('--yes')
  return args
}

function run(args) {
  console.log(`  $ npx ${args.join(' ')}`)
  if (dryRun) return true
  return spawnSync('npx', args, { stdio: 'inherit', cwd: process.cwd() }).status === 0
}

const { path, cfg } = loadConfig()
const agents = cfg.agents ?? ['claude-code']
let scope = cfg.scope ?? 'project'
if (globalOverride) scope = 'global'
if (projectOverride) scope = 'project'

const entries = [...(cfg.bundle ?? []), ...(cfg.mine ?? [])]
if (entries.length === 0) {
  console.error(`✗ No sources listed in ${path} (bundle / mine both empty).`)
  process.exit(1)
}

console.log(
  `\nargo-skills — ${entries.length} source(s), agents=[${agents.join(', ')}], scope=${scope}${dryRun ? ' (dry run)' : ''}`,
)
console.log(`manifest: ${path}\ninstalling into: ${process.cwd()}\n`)

const failed = []
for (const entry of entries) {
  const exclude = entry.skills === '*' ? [].concat(entry.exclude ?? []) : []
  const detail =
    entry.skills && entry.skills !== '*'
      ? ` [${[].concat(entry.skills).join(', ')}]`
      : exclude.length
        ? ` [* minus ${exclude.join(', ')}]`
        : ''
  console.log(`• ${entry.source}${detail}`)
  if (!run(buildArgs(entry, agents, scope))) {
    failed.push(entry.source)
    continue
  }
  for (const name of exclude) {
    if (!run(buildRemoveArgs(name, entry, agents, scope)))
      failed.push(`${entry.source} (remove ${name})`)
  }
}

// Hooks are the opt-in other half of the cross-CLI setup: skills come from `skills add`
// above; with --hooks, the guardrail hooks are copied in whole (descriptor + the scripts
// its commands invoke) and projected per-agent (reusing the same `agents` array), so a
// consumer inherits the same set Argo runs on itself. Off by default — skills only.
if (wantHooks) {
  try {
    installHooks(process.cwd(), agents, dryRun)
  } catch (err) {
    failed.push(`hook setup (${err.message})`)
  }
} else {
  console.log('\nguardrail hooks: skipped (opt in with --hooks)')
}

console.log('')
if (failed.length) {
  console.error(`✗ ${failed.length} source(s) failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(
  dryRun
    ? '✓ Dry run complete — no changes made.'
    : '✓ All skills installed. Any agent in this project can now use them.',
)
