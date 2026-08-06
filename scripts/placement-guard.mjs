#!/usr/bin/env node
// PreToolUse(Write) guardrail: a NEW file may not be created loose at a module root.
//
// `root-files-check.mjs` already fails the build on this, and pre-commit runs it — but both
// land after the fact. By then the misplaced file has imports pointing at it and a turn's worth
// of work built on top, so the fix is a follow-up rather than a correction. This hook denies the
// write itself, at the one moment the decision is free: the folder does not exist yet, nothing
// references the file, and the author is still holding the reason it is being written (ADR-0021).
//
// Deliberately narrow, so it can be a hard deny rather than a warning:
//   - Write only. Edit cannot create a file, so an edit is never a placement decision.
//   - New files only. Overwriting a file already at a root changes no placement; whether that
//     file should be there is the CI gate's question, already answered by allow/ratchet.
//   - Module roots only. A path inside any subfolder passes untouched, which is why a refactor
//     mid-move is never caught: it moves files OUT of roots, and this only guards the way in.
//
// Shares `rootPattern` with the gate on purpose — two copies of that derivation would let this
// hook permit a file the build then rejects. Fails OPEN on every error: an unreadable map or an
// unmapped workspace must never wedge a session, because the gate still catches the file later.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { moduleOf, rootFilesEntry, rootPattern } from './module-map.mjs'

const MAP_SUFFIX = path.join('scripts', 'module-boundaries.json')

/** The workspace governing a file: the nearest ancestor holding a module map. */
export function findWorkspace(absPath, exists = existsSync) {
  let dir = path.dirname(absPath)
  for (;;) {
    if (exists(path.join(dir, MAP_SUFFIX))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * @param {{ filePath?: string, cwd?: string, isAgent?: boolean, workspace?: string|null,
 *           map?: object|null, exists?: (p: string) => boolean }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({ filePath, cwd, isAgent, workspace, map, exists = existsSync }) {
  if (!isAgent || !filePath || !workspace || !map) return { block: false }

  const abs = path.resolve(cwd || process.cwd(), filePath)
  // Already on disk: this write replaces content, it does not place a file.
  if (exists(abs)) return { block: false }

  const rel = path.relative(workspace, abs).split(path.sep).join('/')
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { block: false }

  const owner = moduleOf(rel, map.modules ?? [])
  if (owner === null) return { block: false }

  const entry = rootFilesEntry(map, owner.name)
  if (!rootPattern(owner, entry).test(rel)) return { block: false }

  const name = path.basename(rel)
  if (name in (entry?.allow ?? {}) || name in (entry?.ratchet ?? {})) return { block: false }

  return { block: true, reason: explain(rel, owner.name, entry) }
}

function explain(rel, moduleName, entry) {
  const permitted = Object.keys({ ...(entry?.allow ?? {}), ...(entry?.ratchet ?? {}) })
  const held = permitted.length > 0 ? permitted.join(', ') : '(nothing — this root is closed)'
  return (
    `"${rel}" would be a new file loose at the root of module "${moduleName}", which holds only: ` +
    `${held}.\n\n` +
    `A module root is not a folder for leftovers. Put the file in the sub-domain that owns it, ` +
    `named for what the code is FOR and never for what it IS — "utils/", "types/", "hooks/" and ` +
    `the rest are banned outright. If two or more files would share a prefix, that prefix is the ` +
    `folder name.\n\n` +
    `If it genuinely belongs to no sub-domain, declare it: add the basename to ` +
    `placement.rootFiles.modules.${moduleName}.allow (KIND — the rule does not apply to that ` +
    `category) or .ratchet (RATCHET — debt, a list that may only shrink) in the workspace's ` +
    `scripts/module-boundaries.json, with the reason as its value. Both are read by ` +
    `root-files-check.mjs, which fails the build on this same file otherwise. ` +
    `Rationale: docs/adr/0021-placement-is-declared-per-module.md.`
  )
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  let payload = {}
  try {
    payload = JSON.parse((await readStdin()) || '{}')
  } catch {
    return // Malformed payload — fail open, never wedge the session.
  }

  const cwd = payload.cwd || process.cwd()
  // Claude sends tool_input.file_path; Codex sends toolInput.file_path (camelCase).
  const filePath = payload.tool_input?.file_path ?? payload.toolInput?.file_path
  if (!filePath) return

  let workspace = null
  let map = null
  try {
    workspace = findWorkspace(path.resolve(cwd, filePath))
    if (workspace) map = JSON.parse(readFileSync(path.join(workspace, MAP_SUFFIX), 'utf8'))
  } catch {
    return // No map, or an unreadable one — the build gate is still the backstop.
  }

  const decision = decide({
    filePath,
    cwd,
    workspace,
    map,
    isAgent: Boolean(process.env.CLAUDECODE || process.env.ARGO_HOOK_AGENT),
  })

  if (decision.block) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: decision.reason,
        },
      }),
    )
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
  process.exit(0)
}
