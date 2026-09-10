#!/usr/bin/env node
// PreToolUse(Edit|Write|NotebookEdit|Bash) guardrail: the house rules under `rules/` reach the
// session about to write under them (#1909).
//
// Deny-once. The first write under a rule file is denied with a message naming it; every later
// write under that same rule passes without a word, so the cost is one denied call per rule the
// session actually touches. Context injection would be quieter, but PreToolUse injected context
// is not answered the same way by both harnesses, and a guard that silently does nothing under
// Codex is the failure this hook exists to end.
//
// Gated on an agent marker (CLAUDECODE, or ARGO_HOOK_AGENT injected for markerless harnesses
// like Codex) so it never touches the human's own workflow. decide() is pure: the caller resolves
// the rules, the session's memory and the paths.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALLOW,
  readGuardConfig,
  resolveProjectDir,
  runGuard,
  toolCall,
  underAgent,
} from './hook-io.mjs'
import { readRules, rulesFor } from './rule-paths.mjs'
import { unexpanded } from './shell-commands.mjs'
import { CURRENT_DIRECTORY, writeTargets } from './shell-writes.mjs'

// A worktree holds the same tree one level down, and CLAUDE_PROJECT_DIR often still names the
// main checkout, so a file being edited at `apps/desktop/src/x.ts` arrives as
// `.claude/worktrees/ticket-42/apps/desktop/src/x.ts` and matches `apps/desktop/**` in no rule.
const WORKTREE_PREFIX = /^\.claude[/\\]worktrees[/\\][^/\\]+[/\\]/

/** The path a rule glob is matched against: repository-relative, and inside a worktree, relative
 * to that worktree rather than to the checkout that contains it. */
export function withoutWorktreePrefix(relativePath) {
  return relativePath.split(path.sep).join('/').replace(WORKTREE_PREFIX, '')
}

/** `a, b and c` — the list separator English uses, rather than the one `join` reaches for. */
export function sentenceList(items) {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// The words the message changes with the count, keyed by it, so agreement is one lookup rather
// than a branch per word.
const WORDING = {
  one: { rules: 'that rule', them: 'it', files: 'file' },
  many: { rules: 'those rules', them: 'them', files: 'files' },
}

function refuse(names, docs) {
  const list = sentenceList(names.map((name) => `rules/${name}`))
  const word = names.length > 1 ? WORDING.many : WORDING.one
  return {
    block: true,
    reason:
      `This change is covered by ${list}, and nothing loads ${word.rules} for you. ` +
      `Read ${word.them} now, then make this change again. The second attempt passes, and so ` +
      `does every later change under the same ${word.files}. ` +
      `Each rule file declares what it covers in its own \`paths:\` frontmatter.` +
      (docs ? ` Where the rules sit and how this hook loads them: ${docs}.` : ''),
  }
}

/**
 * Which paths a tool call writes, unresolved. An editor names one; a shell command names as many
 * as its redirections and its write commands do.
 * @param {{ toolName?: string, toolInput?: object }} call
 * @returns {string[]}
 */
export function writtenPaths({ toolName, toolInput = {} }) {
  const named = toolInput.file_path ?? toolInput.notebook_path
  if (typeof named === 'string' && named) return [named]
  const command = toolInput.command
  if (typeof command !== 'string' || (toolName && toolName !== 'Bash')) return []
  // A token still holding a `$` or a backtick is one this hook cannot resolve, and
  // `apply_patch` resolves to the directory rather than to a file it names.
  return writeTargets(command).filter(
    (target) => !unexpanded(target) && target !== CURRENT_DIRECTORY,
  )
}

/**
 * Does this call need a rule read first?
 * @param {{ toolName?: string, toolInput?: object, cwd?: string, projectDir?: string,
 *   isAgent?: boolean, rules?: Array<{ name: string, globs: string[] }>, seen?: string[],
 *   docs?: string }} input
 * @returns {{ block: boolean, reason?: string, rules?: string[] }}
 */
export function decide({
  toolName,
  toolInput = {},
  cwd,
  projectDir,
  isAgent,
  rules = [],
  seen = [],
  docs = '',
}) {
  if (!isAgent || !rules.length) return ALLOW // human workflow — never guarded
  const base = cwd || process.cwd()
  const root = projectDir || base

  const unread = new Set()
  for (const target of writtenPaths({ toolName, toolInput })) {
    const relative = path.relative(root, path.resolve(base, target))
    // Outside the project tree entirely — not ours. A scratchpad or /tmp lands here.
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') continue
    for (const name of rulesFor(rules, withoutWorktreePrefix(relative))) {
      if (!seen.includes(name)) unread.add(name)
    }
  }
  if (!unread.size) return ALLOW
  const names = [...unread]
  return { ...refuse(names, docs), rules: names }
}

// ---------------------------------------------------------------------------------------------
// The session's memory of what it has already been told.
// ---------------------------------------------------------------------------------------------

// State is aged out rather than trusted forever, so a stale file cannot silence the hook on a
// machine for good.
const STATE_TTL_MS = 12 * 60 * 60 * 1000

/** Which session this call belongs to, and in which project. Claude Code names a session in the
 * payload. A harness that names none shares one key across its sessions in that project: the
 * projected command runs through a shell, so the parent process is a fresh one per invocation and
 * a key built from it would be new on every call, which denies the same write forever. Sharing
 * costs a second session in the same project a reminder it should have had, within the window
 * below. `||` rather than `??`, because an empty name is as useless as an absent one. */
export function sessionKey(payload = {}, projectDir = '') {
  const session = payload.session_id || payload.sessionId || 'unnamed'
  // Keyed to the tree the rules were read from, so a session that moves between projects does not
  // carry one project's `rules/` into another. Worktrees of one checkout resolve to the same tree
  // and share a memory, which is right: they share the `rules/` directory too.
  const project = createHash('sha256').update(projectDir).digest('hex').slice(0, 8)
  return `${session}-${project}`
}

const stateFile = (sessionId) =>
  path.join(tmpdir(), 'argo-rules-guard', `${sessionId.replace(/[^\w-]/g, '_')}.json`)

export function seenFor(sessionId, now = Date.now()) {
  const file = stateFile(sessionId)
  try {
    if (now - statSync(file).mtimeMs > STATE_TTL_MS) return []
    const read = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(read) ? read : []
  } catch {
    return []
  }
}

export function record(sessionId, names) {
  const file = stateFile(sessionId)
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(names))
  } catch {
    // A read-only tmpdir costs one repeated denial, not a wedged session.
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGuard((payload) => {
    const cwd = payload.cwd || process.cwd()
    const projectDir = resolveProjectDir(cwd)
    const config = readGuardConfig(projectDir, 'rulesGuard')
    const sessionId = sessionKey(payload, projectDir)
    const seen = seenFor(sessionId)
    // An unset `dir` names no rules, so the guard reads nothing and judges nothing. That is the
    // documented way to retire it, and it is why `hooks.json` is the only place the name lives.
    const rules = config.dir ? readRules(path.resolve(projectDir, config.dir)) : []
    const decision = decide({
      ...toolCall(payload),
      cwd,
      projectDir,
      isAgent: underAgent(),
      rules,
      seen,
      docs: config.docs ?? '',
    })
    // Recorded on the denial, so the retry the message asks for is the call that passes.
    if (decision.block) record(sessionId, [...seen, ...decision.rules])
    return decision
  })
}
