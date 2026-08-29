#!/usr/bin/env node
// PreToolUse(Bash|EnterWorktree) guardrail: a worktree is named at creation, the one moment
// the name is still free to change. worktree-guard.mjs enforces that implementation edits
// happen in a worktree; this enforces which one. Nothing about editing inside an existing tree
// is guarded here, so a tree already named off-convention drains rather than breaks.
// The convention and what parses it: docs/agents/worktrees.md.
//
// decide() is pure string logic (no fs, no git) and unit-tested in worktree-name-guard.test.mjs.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGuard, underAgent } from './hook-io.mjs'

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
// A numberless slug may not itself start with a number: `argo/901-naming` is a dropped `#`,
// and nothing downstream can tell it from work that genuinely has no ticket.
const NAMELESS = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*'
const DIR_RE = new RegExp(String.raw`^ticket-(?:\d+-${SLUG}|${NAMELESS})$`)
const BRANCH_RE = new RegExp(String.raw`^argo/(?:#\d+-${SLUG}|${NAMELESS})$`)
const WORKTREES_DIR = '.claude/worktrees'

// Every refusal ends with this: a guard that says "no" without saying "like this" costs the
// reader a lookup.
const HOW =
  `Name both from the ticket number <N> and one kebab-case <slug>: directory ` +
  `${WORKTREES_DIR}/ticket-<N>-<slug>, branch argo/#<N>-<slug> — e.g. ` +
  `git worktree add -b argo/#30-session-screen ${WORKTREES_DIR}/ticket-30-session-screen. ` +
  `For work with no ticket, keep the shape and drop the number: ticket-<slug> / argo/<slug>. ` +
  `Full rules: docs/agents/worktrees.md.`

const refuse = (what) => ({ block: true, reason: `${what} ${HOW}` })
const ALLOW = { block: false }

// A token still holding a `$` or a backtick is a path this hook cannot resolve; guessing at
// the expansion would deny work over a name that may well be correct.
const unexpanded = (token) => token.includes('$') || token.includes('`')

const directoryName = (dir) => dir.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop()

function checkDirectory(dir) {
  if (unexpanded(dir)) return ALLOW
  if (!dir.replace(/\\/g, '/').includes(`${WORKTREES_DIR}/`)) {
    return refuse(
      `Worktrees live under ${WORKTREES_DIR}/ — "${dir}" does not. A tree outside it is ` +
        `invisible to the edit guard and to \`bun run worktrees:gc\`.`,
    )
  }
  const name = directoryName(dir)
  if (!DIR_RE.test(name)) {
    return refuse(`"${name}" is not a worktree directory name this repo can join to a ticket.`)
  }
  return ALLOW
}

function checkBranch(branch) {
  if (unexpanded(branch) || BRANCH_RE.test(branch)) return ALLOW
  return refuse(`"${branch}" is not a branch name this repo can join to a ticket.`)
}

// The two names differ only in prefix, so a matching pair is the whole point: a number in one
// and not the other is how `885-screenshot-pid-scope` happened.
const stem = (name) => name.replace(/^ticket-/, '').replace(/^argo\/#?/, '')

function checkPair(dir, branch) {
  if (stem(directoryName(dir)) === stem(branch)) return ALLOW
  return refuse(
    `Directory "${directoryName(dir)}" and branch "${branch}" do not share one <N>-<slug> stem.`,
  )
}

// Split on shell separators so `cd x && git worktree add …` is seen, and drop anything after a
// heredoc opener — its body is data the shell never runs as a command. Quotes and subshell
// parens are stripped because the arguments read here are paths and branch names.
const segments = (command) => command.split('<<')[0].split(/&&|\|\||;|\||\n/)
const tokenize = (segment) =>
  segment
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[('"]+|[)'"]+$/g, ''))
    .filter(Boolean)

/**
 * The arguments of a git invocation, or null when the segment is not one. Only a segment that
 * *starts* with git is a command — `grep "git worktree add" docs/` is a mention, not a creation.
 */
function gitArgs(tokens) {
  let i = 0
  while (i < tokens.length && (tokens[i] === 'rtk' || tokens[i].includes('='))) i += 1
  if (tokens[i] !== 'git') return null
  i += 1
  // git's own options precede the subcommand: `git -C <dir> …`, `git --git-dir=… …`.
  while (i < tokens.length && tokens[i].startsWith('-')) i += tokens[i] === '-C' ? 2 : 1
  return tokens.slice(i)
}

const branchFlag = (token) =>
  (token.startsWith('-b') || token.startsWith('-B')) && token.length > 2 ? token.slice(2) : null

/** Positional path and explicit branch of a `git worktree add`, or null. */
function parseWorktreeAdd(args) {
  if (args[0] !== 'worktree' || args[1] !== 'add') return null
  let branch
  const positionals = []
  for (let i = 2; i < args.length; i += 1) {
    const token = args[i]
    if (token === '-b' || token === '-B') {
      i += 1
      branch = args[i]
    } else if (branchFlag(token)) branch = branchFlag(token)
    else if (!token.startsWith('-')) positionals.push(token)
  }
  return { dir: positionals[0], branch }
}

// The flag that names a NEW branch for the work in hand, per subcommand. `git branch -m` is the
// documented second half of entering a worktree; -c/-b reach the same end state by another road.
const BRANCH_FLAGS = {
  branch: ['-m', '-M', '--move'],
  switch: ['-c', '-C', '--create'],
  checkout: ['-b', '-B'],
}

/** New branch name a segment puts the current work on, or null. */
function parseBranchCreate(args) {
  const flags = BRANCH_FLAGS[args[0]]
  if (!flags) return null
  const rest = args.slice(1)
  const at = rest.findIndex((token) => flags.includes(token))
  if (at < 0) return null
  const names = rest.slice(at + 1).filter((token) => !token.startsWith('-'))
  // `git branch -m <old> <new>` renames a branch that is not the one in hand — never ours.
  if (args[0] === 'branch' && names.length > 1) return null
  return names[0] ?? null
}

function checkAdd({ dir, branch }) {
  // No path is git's own error to report. Only an explicit branch is ours: a bare
  // `git worktree add <path> <branch>` recovers an existing branch, and detaching names none.
  if (!dir) return ALLOW
  const directory = checkDirectory(dir)
  if (directory.block) return directory
  if (!branch) return ALLOW
  const named = checkBranch(branch)
  return named.block || unexpanded(dir) || unexpanded(branch) ? named : checkPair(dir, branch)
}

function checkSegment(tokens, cwd) {
  const args = gitArgs(tokens)
  if (!args) return ALLOW
  const add = parseWorktreeAdd(args)
  if (add) return checkAdd(add)
  const branch = parseBranchCreate(args)
  const inWorktree = String(cwd || '')
    .replace(/\\/g, '/')
    .includes(`${WORKTREES_DIR}/`)
  return branch && inWorktree ? checkBranch(branch) : ALLOW
}

function checkBash(command, cwd) {
  for (const segment of segments(command)) {
    const decision = checkSegment(tokenize(segment), cwd)
    if (decision.block) return decision
  }
  return ALLOW
}

/**
 * @param {{ toolName?: string, toolInput?: object, cwd?: string, isAgent?: boolean }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({ toolName, toolInput = {}, cwd, isAgent }) {
  if (!isAgent) return ALLOW // human workflow — never guarded
  if (toolName === 'EnterWorktree') {
    // `path` re-enters an existing tree; only a `name` creates one, and only a name can still
    // be chosen. This is how a tree named before this guard keeps working.
    if (toolInput.path || !toolInput.name) return ALLOW
    return checkDirectory(`${WORKTREES_DIR}/${toolInput.name}`)
  }
  if (toolName === 'Bash' && typeof toolInput.command === 'string') {
    return checkBash(toolInput.command, cwd)
  }
  return ALLOW
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGuard((payload) =>
    decide({
      toolName: payload.tool_name ?? payload.toolName,
      // Claude sends tool_input; Codex sends toolInput (camelCase).
      toolInput: payload.tool_input ?? payload.toolInput ?? {},
      cwd: payload.cwd || process.cwd(),
      isAgent: underAgent(),
    }),
  )
}
