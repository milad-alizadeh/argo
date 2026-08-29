#!/usr/bin/env node
// PreToolUse(Bash|EnterWorktree) guardrail: a worktree must be created under the
// documented name. worktree-guard.mjs enforces that implementation edits happen in a
// worktree; this one enforces which worktree, at the only moment the name can still be
// changed for free — creation. Editing inside an already-created tree is never blocked,
// so trees created before this guard (and any agent running in one) drain untouched.
//
// The `#<N>` is load-bearing twice (docs/agents/worktrees.md): /ship parses it to write
// `Closes #<N>`, and WorkItemLink parses it to name the cockpit Session's row after the
// ticket (#745). Neither can recover a number that was never written, which is why the
// repair is at the keyboard and not in the recogniser (#894 rejected the reader-side fix).
//
// Work with no ticket is still allowed to start — refusing it would push spikes back into
// the shared main checkout, the worse failure worktree-guard.mjs exists to prevent. It
// takes the documented numberless shape (`ticket-<slug>` / `argo/<slug>`), so a missing
// number is a declared fact rather than a name that merely looks broken.
//
// decide() is pure string logic (no fs, no git) and unit-tested in worktree-name-guard.test.mjs.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAgent, runGuard } from './hook-io.mjs'

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
// The numberless slug may not start with a number: `argo/901-naming` is a dropped `#`, not a
// deliberate statement that this work has no ticket, and nothing downstream can tell them apart.
const NAMELESS = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*'
// `ticket-<N>-<slug>`, or `ticket-<slug>` for work with no ticket.
const DIR_RE = new RegExp(String.raw`^ticket-(?:\d+-${SLUG}|${NAMELESS})$`)
// `argo/#<N>-<slug>`, or `argo/<slug>` for work with no ticket.
const BRANCH_RE = new RegExp(String.raw`^argo/(?:#\d+-${SLUG}|${NAMELESS})$`)
const WORKTREES_DIR = '.claude/worktrees'

// Every refusal ends with this: a guard that says "no" without saying "like this" costs
// every future session a lookup.
const HOW =
  `Name it from the ticket number <N> and a kebab-case <slug>: directory ` +
  `${WORKTREES_DIR}/ticket-<N>-<slug>, branch argo/#<N>-<slug> — e.g. ` +
  `git worktree add -b argo/#30-session-screen ${WORKTREES_DIR}/ticket-30-session-screen. ` +
  `For work with no ticket, keep the shape and drop the number: ticket-<slug> / argo/<slug>. ` +
  `Full rules: docs/agents/worktrees.md.`

const refuse = (what) => ({ block: true, reason: `${what} ${HOW}` })

function checkDirectory(dir) {
  const normalised = dir.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalised.includes(`${WORKTREES_DIR}/`)) {
    return refuse(
      `Worktrees live under ${WORKTREES_DIR}/ — "${dir}" does not. A tree outside it is ` +
        `invisible to the edit guard and to \`bun run worktrees:gc\`.`,
    )
  }
  const name = normalised.split('/').pop()
  if (!DIR_RE.test(name)) {
    return refuse(`"${name}" is not a worktree directory name this repo can join to a ticket.`)
  }
  return { block: false }
}

function checkBranch(branch) {
  if (BRANCH_RE.test(branch)) return { block: false }
  return refuse(`"${branch}" is not a branch name this repo can join to a ticket.`)
}

// Split on shell separators so `cd x && git worktree add …` is seen, and strip quotes —
// the arguments this reads are paths and branch names, never shell expressions.
const segments = (command) => command.split(/&&|\|\||;|\n/)
const tokenize = (segment) =>
  segment
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)

/** Positional path and explicit -b/-B branch of a `git worktree add`, or null. */
function parseWorktreeAdd(tokens) {
  const git = tokens.indexOf('git')
  if (git < 0 || tokens[git + 1] !== 'worktree' || tokens[git + 2] !== 'add') return null
  let branch
  const positionals = []
  for (let i = git + 3; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === '-b' || token === '-B') {
      i += 1
      branch = tokens[i]
    } else if (token === '--reason') i += 1
    else if (!token.startsWith('-')) positionals.push(token)
  }
  return { dir: positionals[0], branch }
}

/** New name of a `git branch -m/-M`, or null. */
function parseBranchRename(tokens) {
  const git = tokens.indexOf('git')
  if (git < 0 || tokens[git + 1] !== 'branch') return null
  const rest = tokens.slice(git + 2)
  const flag = rest.findIndex((t) => t === '-m' || t === '-M')
  if (flag < 0) return null
  const names = rest.slice(flag + 1).filter((t) => !t.startsWith('-'))
  return names.length ? names[names.length - 1] : null
}

// Only an explicit -b is ours: a bare `git worktree add <path> <branch>` is the documented
// recovery of an existing branch, and detaching names no branch at all. No path is git's own
// error to report, not ours.
function checkAdd({ dir, branch }) {
  const directory = dir ? checkDirectory(dir) : { block: false }
  if (directory.block) return directory
  return branch ? checkBranch(branch) : { block: false }
}

function checkSegment(tokens, cwd) {
  const add = parseWorktreeAdd(tokens)
  if (add) return checkAdd(add)
  // Renaming inside a worktree is the documented second half of entering one; renaming it to
  // something off-convention re-opens exactly the hole creation just closed.
  const renamed = parseBranchRename(tokens)
  const inWorktree = String(cwd || '').includes(`${WORKTREES_DIR}/`)
  return renamed && inWorktree ? checkBranch(renamed) : { block: false }
}

function checkBash(command, cwd) {
  for (const segment of segments(command)) {
    const decision = checkSegment(tokenize(segment), cwd)
    if (decision.block) return decision
  }
  return { block: false }
}

/**
 * @param {{ toolName?: string, toolInput?: object, cwd?: string, isAgent?: boolean }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({ toolName, toolInput = {}, cwd, isAgent }) {
  if (!isAgent) return { block: false } // human workflow — never guarded
  if (toolName === 'EnterWorktree') {
    // `path` re-enters an existing tree; only a `name` creates one, and only a name can
    // still be chosen. This is how the trees named before this guard keep working.
    if (toolInput.path || !toolInput.name) return { block: false }
    return checkDirectory(`${WORKTREES_DIR}/${toolInput.name}`)
  }
  if (toolName === 'Bash' && typeof toolInput.command === 'string') {
    return checkBash(toolInput.command, cwd)
  }
  return { block: false }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGuard((payload) =>
    decide({
      toolName: payload.tool_name ?? payload.toolName,
      // Claude sends tool_input; Codex sends toolInput (camelCase).
      toolInput: payload.tool_input ?? payload.toolInput ?? {},
      cwd: payload.cwd || process.cwd(),
      isAgent: isAgent(),
    }),
  )
}
