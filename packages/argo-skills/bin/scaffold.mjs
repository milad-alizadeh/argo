#!/usr/bin/env node
// argo-skills — install Argo's skill bundle (its own skills plus a curated third-party set)
// into the current project. The bundle is the repo-root `skills-lock.json` manifest, which
// enumerates every skill by name; this drives `npx skills add` from it, one call per source.
//
// `skills experimental_install` reads the same lock and would collapse this to one call, but
// it hardcodes its agent list to `getUniversalAgents()` — every agent whose skills directory
// is `.agents/skills`. Claude Code's is `.claude/skills`, so it is not in that set and gets
// nothing. Passing `--agent` here is the only way to reach it (see AGENTS.md "Skill bundle").

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRoot, hookAgents, sync as syncHooks } from './hooks-sync.mjs'
import {
  describeRestore,
  restoreOwnedSkills,
  snapshotOwnedSkills,
} from './protect-owned-skills.mjs'
import { groupBySource, LOCK_PATH } from './skills-lock.mjs'

const STARTER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// The Argo checkout root (STARTER_DIR is <root>/packages/argo-skills). `npx github:…`
// clones the whole repo, so the guardrail-hook assets sit here.
const SOURCE_ROOT = resolve(STARTER_DIR, '..', '..')
// Which harnesses the skills are published to. `.agents/skills` is shared by every agent
// the CLI calls universal, so only Claude Code needs naming — the other two are kept
// explicit because they document the intended audience.
const SKILL_AGENTS = ['claude-code', 'cursor', 'codex']
// The full guardrail set copied into every target: the neutral descriptor, the two
// scripts its projected commands invoke, and the worktree contract the edit-guard's
// deny message cites (so the rules land with the enforcement). Lockstep with hooks.json.
const HOOK_ASSETS = [
  'hooks.json',
  'scripts/worktree-guard.mjs',
  'scripts/worktree-gc.sh',
  'docs/agents/worktrees.md',
]
// A lock has no scope field: `skills add --global` writes a different lock format in a
// different place, which is a second install path rather than an option on this one.
const SCOPE_FLAGS = ['--global', '-g', '--project', '-p']

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

// Copy the guardrail-hook assets from the Argo checkout into the target project, then
// project the descriptor into each agent's config. Target is the git root, not the cwd:
// the projected commands resolve scripts via `git rev-parse --show-toplevel`, so a run
// from a subdirectory must still land the assets at the repo root. Skipped when
// installing into Argo itself (source === target), and a no-op when the assets aren't in
// this install (e.g. an npm-published, skills-only package) so it degrades gracefully.
function installHooks(cwd, dryRun) {
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
  const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'))
  console.log('\nprojecting hooks per-agent:')
  syncHooks({ root: target, descriptor, agents: hookAgents(descriptor), dryRun })
}

// `--skill a b` / `--skill a,b` — the subset to install. Absent means the whole manifest.
function parseSelection(argv) {
  const flagIndex = argv.indexOf('--skill')
  if (flagIndex === -1) return null
  const names = []
  for (let i = flagIndex + 1; i < argv.length && !argv[i].startsWith('-'); i++) {
    names.push(...argv[i].split(',').filter(Boolean))
  }
  if (names.length === 0) fail('--skill needs at least one skill name')
  return names
}

// The names to install, every one checked against the manifest before any source runs — a
// typo must not install a partial bundle and then report failure.
function selectedNames(manifest, selection) {
  const names = selection ?? Object.keys(manifest.skills)
  const unknown = names.filter((name) => !manifest.skills[name])
  if (unknown.length) {
    const available = Object.keys(manifest.skills).join(', ')
    fail(`not in the bundle: ${unknown.join(', ')}\n  available: ${available}`)
  }
  return names
}

const argv = process.argv.slice(2)
const has = (...flags) => flags.some((f) => argv.includes(f))
const dryRun = has('--dry-run', '-n')
// Guardrail hooks are opt-in: they impose Argo's worktree discipline (apps/+packages/
// edit guard, worktree reaper) on the project, so a consumer chooses them explicitly.
const wantHooks = has('--hooks') && !has('--no-hooks')

if (has(...SCOPE_FLAGS)) {
  fail(
    `scope flags are not supported (${SCOPE_FLAGS.join(', ')}) — this installer only writes a project lock`,
  )
}

let manifest = null
try {
  manifest = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
} catch (err) {
  // The manifest is the Argo checkout's root lock, outside this package, and `files` ships
  // no copy of it — so only a git-based install has one. Say which install path works.
  fail(
    `No bundle manifest at ${LOCK_PATH}\n  Install with: npx github:milad-alizadeh/argo\n  (${err.message})`,
  )
}
if (!manifest.skills) fail(`${LOCK_PATH} has no "skills" map — it is not a skills lock.`)

const selection = parseSelection(argv)
const bySource = groupBySource(manifest, selectedNames(manifest, selection))
const total = [...bySource.values()].reduce((count, names) => count + names.length, 0)
console.log(
  `\nargo-skills — ${total} skill(s) from ${bySource.size} source(s), agents=[${SKILL_AGENTS.join(', ')}]${selection ? ' (subset)' : ''}${dryRun ? ' (dry run)' : ''}`,
)
console.log(`manifest: ${LOCK_PATH}\ninstalling into: ${process.cwd()}\n`)

// Taken before the first source installs: `skills add` replaces a colliding skill directory
// with a symlink into its own payload, deleting whatever the repo had there.
const projectRoot = gitRoot(process.cwd())
const ownedSkills = dryRun ? [] : snapshotOwnedSkills(projectRoot)

const failed = []
for (const [source, names] of bySource) {
  // Leading --yes is npx's (fetch the CLI unprompted); trailing --yes is the skills CLI's.
  const args = ['--yes', 'skills', 'add', source]
  args.push('--skill', ...names, '--agent', ...SKILL_AGENTS, '--yes')
  console.log(`• ${source} [${names.length}]\n  $ npx ${args.join(' ')}`)
  if (!dryRun && spawnSync('npx', args, { stdio: 'inherit' }).status !== 0) failed.push(source)
}

const restored = restoreOwnedSkills(projectRoot, ownedSkills)
if (restored.length) console.log(describeRestore(restored))

if (wantHooks) {
  try {
    installHooks(process.cwd(), dryRun)
  } catch (err) {
    failed.push(`hook setup (${err.message})`)
  }
} else {
  console.log('\nguardrail hooks: skipped (opt in with --hooks)')
}

console.log('')
if (failed.length) fail(`${failed.length} source(s) failed: ${failed.join(', ')}`)
console.log(
  dryRun
    ? '✓ Dry run complete — no changes made.'
    : '✓ All skills installed. Any agent in this project can now use them.',
)
