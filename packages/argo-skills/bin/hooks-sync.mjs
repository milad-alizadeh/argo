#!/usr/bin/env node
// Project the neutral hooks.json descriptor into each harness's own hook config (the
// hooks half of the cross-CLI setup; skills-lock.json is the skills half). project() is pure
// and unit-tested; sync() does the IO. Per-hook rationale lives in hooks.json.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Neutral event -> harness event key. Codex uses the same PascalCase keys as Claude
// Code, so one map serves both; a future harness that renames events overrides here.
const EVENT_MAP = {
  'pre-tool': 'PreToolUse',
  'session-end': 'SessionEnd',
}

// Per-harness registration knowledge — the only place harness specifics live.
// nativeAgentMarker: harness sets its own "under an agent" env var (Claude's CLAUDECODE);
// false means agentGated hooks need ARGO_HOOK_AGENT injected (Codex has no equivalent).
const HARNESSES = {
  'claude-code': { target: '.claude/settings.json', nativeAgentMarker: true },
  codex: { target: '.codex/hooks.json', nativeAgentMarker: false },
}

// A group in an existing config is one of ours (regenerated on every sync) if its command
// invokes one of these; anything else is the consumer's own hook and is preserved.
// Every script hooks.json names belongs here: one missing entry reads our own hook as the
// consumer's, so the sync preserves it AND appends a fresh copy, and the file grows a
// duplicate per run. `scripts/hooks-sync.test.mjs` derives this list from hooks.json.
const MANAGED_MARKERS = [
  'hook-guard',
  'worktree-guard.mjs',
  'placement-guard.mjs',
  'worktree-gc.sh',
]

/**
 * Build one harness's hook block from the neutral descriptor. Pure — no IO.
 * @param {{ hooks: Array<object> }} descriptor
 * @param {string} agentId
 * @returns {{ known: boolean, target?: string, hooksBlock?: object, warnings: string[] }}
 */
export function project(descriptor, agentId) {
  const harness = HARNESSES[agentId]
  const warnings = []
  if (!harness) return { known: false, warnings }

  const hooksBlock = {}
  for (const entry of descriptor.hooks ?? []) {
    const eventKey = EVENT_MAP[entry.event]
    if (!eventKey) {
      warnings.push(`unknown event "${entry.event}" — skipped`)
      continue
    }
    // agentGated scripts need the "under an agent" signal. Claude's CLAUDECODE
    // supplies it natively; harnesses without a marker get it injected.
    const command =
      entry.agentGated && !harness.nativeAgentMarker
        ? `ARGO_HOOK_AGENT=1 ${entry.command}`
        : entry.command

    const handler = { type: 'command', command }
    if (entry.timeout != null) handler.timeout = entry.timeout
    if (entry.statusMessage != null) handler.statusMessage = entry.statusMessage

    const group = {}
    if (entry.matcher != null) group.matcher = entry.matcher
    group.hooks = [handler]

    hooksBlock[eventKey] ??= []
    hooksBlock[eventKey].push(group)
  }

  return { known: true, target: harness.target, hooksBlock, warnings }
}

const isManaged = (group) =>
  group.hooks?.some((h) => MANAGED_MARKERS.some((m) => h.command?.includes(m)))

// Preserve the consumer's own hook groups; replace only ours (idempotent re-sync).
export function mergeHooks(existing = {}, ours) {
  const merged = {}
  for (const [event, groups] of Object.entries(existing)) {
    const foreign = groups.filter((g) => !isManaged(g))
    if (foreign.length) merged[event] = foreign
  }
  for (const [event, groups] of Object.entries(ours)) {
    merged[event] = [...(merged[event] ?? []), ...groups]
  }
  return merged
}

/**
 * Which harnesses a descriptor is projected into. Lives in hooks.json so the hook SSOT
 * carries its own audience; `scaffold.mjs` and `main()` below read it through here.
 * @param {{ agents?: string[] }} descriptor
 * @returns {string[]}
 */
export function hookAgents(descriptor) {
  return descriptor.agents ?? ['claude-code']
}

export function gitRoot(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
  } catch {
    return cwd
  }
}

/**
 * Project the descriptor for every agent and write each harness's config, merging into
 * whatever hooks the consumer already has. `root` is the repo root the configs live under.
 * @returns {Array<{ agent: string, target?: string, action: string }>}
 */
export function sync({ root, descriptor, agents, dryRun = false, log = console.log }) {
  const results = []
  for (const agent of agents) {
    const { known, target, hooksBlock, warnings } = project(descriptor, agent)
    for (const w of warnings) log(`  ⚠ ${agent}: ${w}`)
    if (!known) {
      log(`  ⚠ ${agent}: no hook projection for this harness — skipped`)
      results.push({ agent, action: 'skipped' })
      continue
    }

    const abs = path.resolve(root, target)
    let file = {}
    if (existsSync(abs)) {
      // Throw rather than start from {}: the next statements rewrite this path in full, so
      // treating an unparseable config as absent deletes whatever it held — a consumer's
      // permissions, env and model pin, silently, on a file this tool only meant to add to.
      // A trailing comma is a fixable typo; losing the file is not.
      try {
        file = JSON.parse(readFileSync(abs, 'utf8'))
      } catch (err) {
        throw new Error(
          `${target} is not valid JSON and would be overwritten: ${err.message}\n` +
            `  Fix or move ${abs}, then re-run. Nothing was written.`,
        )
      }
    }
    file.hooks = mergeHooks(file.hooks, hooksBlock)

    log(`  ${dryRun ? 'would write' : 'wrote'} ${target} (${agent})`)
    if (!dryRun) {
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, `${JSON.stringify(file, null, 2)}\n`)
    }
    results.push({ agent, target, action: dryRun ? 'would-write' : 'wrote' })
  }
  return results
}

function main() {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run') || argv.includes('-n')
  const root = gitRoot(process.cwd())

  const descriptorPath = path.join(root, 'hooks.json')
  if (!existsSync(descriptorPath)) {
    console.log(`hooks-sync: no hooks.json at ${root} — nothing to project.`)
    return
  }
  const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'))

  const agents = hookAgents(descriptor)
  console.log(`hooks-sync — agents=[${agents.join(', ')}]${dryRun ? ' (dry run)' : ''}`)
  sync({ root, descriptor, agents, dryRun })
  console.log('✓ hooks projected.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
