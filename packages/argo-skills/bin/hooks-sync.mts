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
/** One hook, as hooks.json writes it. */
export type HookEntry = {
  event: string
  command: string
  matcher?: string
  agentGated?: boolean
  timeout?: number
  statusMessage?: string
}

/** The whole descriptor. */
export type HookDescriptor = { hooks?: HookEntry[]; agents?: string[] }

/** One registered hook in a harness config. */
type Handler = { type: string; command: string; timeout?: number; statusMessage?: string }

/** A matcher and the hooks it fires, which is the shape both harnesses store. */
type HookGroup = { matcher?: string; hooks?: Handler[] }

/** A harness config's `hooks` key: event name to the groups registered under it. */
export type HooksBlock = Record<string, HookGroup[]>

const EVENT_MAP: Record<string, string | undefined> = {
  'pre-tool': 'PreToolUse',
  'post-tool': 'PostToolUse',
  'user-prompt-submit': 'UserPromptSubmit',
  'session-end': 'SessionEnd',
}

// Per-harness registration knowledge — the only place harness specifics live.
// nativeAgentMarker: harness sets its own "under an agent" env var (Claude's CLAUDECODE);
// false means agentGated hooks need ARGO_HOOK_AGENT injected (Codex has no equivalent).
const HARNESSES: Record<string, { target: string; nativeAgentMarker: boolean } | undefined> = {
  'claude-code': { target: '.claude/settings.json', nativeAgentMarker: true },
  codex: { target: '.codex/hooks.json', nativeAgentMarker: false },
}

/**
 * The script filenames that mark a hook group as ours, read off the descriptor rather than
 * listed by hand.
 *
 * A group in an existing config is one of ours (regenerated on every sync) if its command
 * invokes one of these; anything else is the consumer's own hook and is preserved. This was a
 * hardcoded list, and every script hooks.json named had to be added to it: one missing entry
 * read our own hook as the consumer's, so the sync preserved it AND appended a fresh copy, and
 * the projection grew a duplicate on every run. A test kept the list honest, which meant the
 * guarantee lasted exactly as long as the test did. Deriving the markers from the very commands
 * the projection is built from removes the possibility rather than checking for it.
 *
 * The last path segment is the marker, so it survives the git-toplevel prefix in front of it and
 * any relocation of the directory the scripts live in.
 */
export function managedMarkers(descriptor: HookDescriptor): string[] {
  const markers = (descriptor.hooks ?? []).flatMap(
    (entry) => entry.command?.match(/[\w.-]+\.(?:mts|mjs|js|sh|py)/g) ?? [],
  )
  return [...new Set(markers)]
}

/** Build one harness's hook block from the neutral descriptor. Pure — no IO. */
export function project(
  descriptor: HookDescriptor,
  agentId: string,
): { known: boolean; target?: string; hooksBlock?: HooksBlock; warnings: string[] } {
  const harness = HARNESSES[agentId]
  const warnings: string[] = []
  if (!harness) return { known: false, warnings }

  const hooksBlock: HooksBlock = {}
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

    const handler: Handler = { type: 'command', command }
    if (entry.timeout != null) handler.timeout = entry.timeout
    if (entry.statusMessage != null) handler.statusMessage = entry.statusMessage

    const group: HookGroup = { hooks: [handler] }
    if (entry.matcher != null) group.matcher = entry.matcher
    hooksBlock[eventKey] = [...(hooksBlock[eventKey] ?? []), group]
  }

  return { known: true, target: harness.target, hooksBlock, warnings }
}

const isManaged = (group: HookGroup, markers: string[]): boolean =>
  group.hooks?.some((h) => markers.some((m) => h.command?.includes(m))) ?? false

/**
 * Preserve the consumer's own hook groups; replace only ours (idempotent re-sync). `markers` comes
 * from `managedMarkers()`, so what counts as ours is whatever the descriptor names now rather than
 * a list somebody has to remember to update.
 */
export function mergeHooks(
  existing: HooksBlock = {},
  ours: HooksBlock,
  markers: string[] = [],
): HooksBlock {
  const merged: HooksBlock = {}
  for (const [event, groups] of Object.entries(existing)) {
    const foreign = groups.filter((g) => !isManaged(g, markers))
    if (foreign.length) merged[event] = foreign
  }
  for (const [event, groups] of Object.entries(ours)) {
    merged[event] = [...(merged[event] ?? []), ...groups]
  }
  return merged
}

/**
 * Which harnesses a descriptor is projected into. Lives in hooks.json so the hook SSOT
 * carries its own audience; `main()` below reads it through here.
 */
export function hookAgents(descriptor: HookDescriptor): string[] {
  return descriptor.agents ?? ['claude-code']
}

export function gitRoot(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
  } catch {
    return cwd
  }
}

/** What one agent's projection did. */
type SyncResult = { agent: string; target?: string; action: string }

/**
 * Project the descriptor for every agent and write each harness's config, merging into
 * whatever hooks the consumer already has. `root` is the repo root the configs live under.
 */
export function sync({
  root,
  descriptor,
  agents,
  dryRun = false,
  log = console.log,
}: {
  root: string
  descriptor: HookDescriptor
  agents: string[]
  dryRun?: boolean
  log?: (message: string) => void
}): SyncResult[] {
  const results: SyncResult[] = []
  for (const agent of agents) {
    const { known, target, hooksBlock, warnings } = project(descriptor, agent)
    for (const w of warnings) log(`  ⚠ ${agent}: ${w}`)
    if (!known) {
      log(`  ⚠ ${agent}: no hook projection for this harness — skipped`)
      results.push({ agent, action: 'skipped' })
      continue
    }

    const abs = path.resolve(root, target ?? '')
    let file: { hooks?: HooksBlock } = {}
    if (existsSync(abs)) {
      // Throw rather than start from {}: the next statements rewrite this path in full, so
      // treating an unparseable config as absent deletes whatever it held — a consumer's
      // permissions, env and model pin, silently, on a file this tool only meant to add to.
      // A trailing comma is a fixable typo; losing the file is not.
      try {
        file = JSON.parse(readFileSync(abs, 'utf8'))
      } catch (err) {
        throw new Error(
          `${target} is not valid JSON and would be overwritten: ${(err as Error).message}\n` +
            `  Fix or move ${abs}, then re-run. Nothing was written.`,
        )
      }
    }
    file.hooks = mergeHooks(file.hooks, hooksBlock ?? {}, managedMarkers(descriptor))

    log(`  ${dryRun ? 'would write' : 'wrote'} ${target} (${agent})`)
    if (!dryRun) {
      mkdirSync(path.dirname(abs), { recursive: true })
      writeFileSync(abs, `${JSON.stringify(file, null, 2)}\n`)
    }
    results.push({ agent, target, action: dryRun ? 'would-write' : 'wrote' })
  }
  return results
}

function main(): void {
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
