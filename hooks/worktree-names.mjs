// WHICH worktree the work runs in: a tree is named at creation, the one moment the name is still
// free to change. The other half of the same rule, WHERE the work runs, is worktree-guard.mjs,
// and that file is the hook. This one is a module it imports, not a second hook: there is one
// hooks.json entry, on the union of the two matchers, and one command the projection invokes.
// The split across two files is a file-length one and carries no behaviour of its own.
//
// Nothing about editing inside an existing tree is guarded here, so a tree already named
// off-convention drains rather than breaks (#901). `EnterWorktree` cannot reach the convention by
// any input, so only its `path:` passes (#1684).
//
// decideName() is pure string logic: no fs, no git.
// The convention and what parses it: docs/agents/worktrees.md.
import { ALLOW } from './hook-io.mjs'
import { afterGitOptions, invocation, segments, tokenize, unexpanded } from './shell-commands.mjs'

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
// A numberless slug may not itself start with a number: `901-naming` is a dropped `#`, and
// nothing downstream can tell it from work that genuinely has no ticket.
const NAMELESS = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*'

// The convention belongs to the project, not to this file. `worktreeGuard.branchPrefix` in
// hooks.json is what turns the naming half on: a project that has declared no branch convention
// has none to enforce, and a guard that invented one would refuse every name that project
// already uses. Unconfigured, this half checks only that a new tree lands under `dir`, which is
// the edit guard's and the reaper's one real requirement.
// Only the keys with a non-empty default live here; `branchPrefix` and `docs` default to the
// empty string at their one reader, which is what turns the naming half off.
export const DEFAULTS = { dir: '.claude/worktrees', publishBranches: [] }

const literalRe = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function namingRules(config = {}) {
  const dir = config.dir || DEFAULTS.dir
  const prefix = config.branchPrefix || ''
  const docs = config.docs || ''
  const cite = docs ? ` Full rules: ${docs}.` : ''
  const named = Boolean(prefix)
  const tree = named ? 'ticket-<N>-<slug>' : '<name>'

  return {
    dir,
    named,
    tree,
    // Namespaces that publish rather than carry work: a design page, an evidence branch. They
    // join to no ticket by construction, so the ticket-join rule below would refuse every one.
    publish: config.publishBranches || DEFAULTS.publishBranches,
    branchShape: named ? `${prefix}#<N>-<slug>` : '<branch>',
    dirRe: new RegExp(String.raw`^ticket-(?:\d+-${SLUG}|${NAMELESS})$`),
    branchRe: new RegExp(String.raw`^${literalRe(prefix)}(?:#\d+-${SLUG}|${NAMELESS})$`),
    // Every refusal ends with this: a guard that says "no" without saying "like this" costs the
    // reader a lookup.
    how: named
      ? `Name both from the ticket number <N> and one kebab-case <slug>: directory ` +
        `${dir}/ticket-<N>-<slug>, branch ${prefix}#<N>-<slug>. For work with no ticket, keep ` +
        `the shape and drop the number: ticket-<slug> / ${prefix}<slug>.${cite}`
      : `Put the tree under ${dir}/.${cite}`,
    // The second half of the two-step. It rides on the refusals that name a tree the session is
    // not in yet rather than on `how`, because a branch-rename refusal names no tree at all:
    // that session is standing in one already, and telling it how to enter one is noise.
    enter:
      `Enter the tree it makes by path: EnterWorktree { path: "${dir}/${tree}" } in Claude ` +
      `Code, cd in any other harness.`,
  }
}

// Module-level current rules, set once by the hook's entrypoint from the descriptor that travels
// beside it, so the pure logic below stays free of fs and git.
let rules = namingRules()
export function configureNaming(config) {
  rules = namingRules(config)
  return rules
}

const twoStep = () =>
  `Create the tree with git: git worktree add -b ${rules.branchShape} ${rules.dir}/${rules.tree}. ${rules.enter}`

const refuseName = (what) => ({ block: true, reason: `${what} ${rules.how}` })

const addEntryStep = (decision) =>
  decision.block ? { ...decision, reason: `${decision.reason} ${rules.enter}` } : decision

const directoryName = (dir) => dir.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop()

function checkDirectory(dir) {
  if (unexpanded(dir)) return ALLOW
  if (!dir.replace(/\\/g, '/').includes(`${rules.dir}/`)) {
    return refuseName(
      `Worktrees live under ${rules.dir}/ — "${dir}" does not. A tree outside it is ` +
        `invisible to the edit guard and to the worktree reaper.`,
    )
  }
  if (!rules.named) return ALLOW
  const name = directoryName(dir)
  if (!rules.dirRe.test(name)) {
    return refuseName(`"${name}" is not a worktree directory name this repo can join to a ticket.`)
  }
  return ALLOW
}

const isPublish = (branch) => rules.publish.some((p) => branch.startsWith(p))

function checkBranch(branch) {
  if (!rules.named || unexpanded(branch) || rules.branchRe.test(branch)) return ALLOW
  if (isPublish(branch)) return ALLOW
  return refuseName(`"${branch}" is not a branch name this repo can join to a ticket.`)
}

// The two names differ only in prefix, so a matching pair is the whole point: a number in one
// and not the other is how `885-screenshot-pid-scope` happened.
const stem = (name) =>
  name
    .replace(/^ticket-/, '')
    .replace(new RegExp(`^${literalRe(rules.branchShape.split('#')[0])}#?`), '')

function checkPair(dir, branch) {
  if (stem(directoryName(dir)) === stem(branch)) return ALLOW
  return refuseName(
    `Directory "${directoryName(dir)}" and branch "${branch}" do not share one <N>-<slug> stem.`,
  )
}

/**
 * The arguments of a git invocation, or null when the segment is not one. Only a segment that
 * *starts* with git is a command: `grep "git worktree add" docs/` is a mention, not a creation.
 */
function gitArgs(tokens) {
  const { name, args } = invocation(tokens)
  return name === 'git' ? afterGitOptions(args) : null
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
  // The pair check joins two names through a shared stem, which only exists where the project
  // declared the shape that produces one. Without a convention, and in a publish namespace whose
  // branch carries no stem at all, there is nothing to join.
  if (!branch || !rules.named || isPublish(branch)) return ALLOW
  const named = checkBranch(branch)
  return named.block || unexpanded(dir) || unexpanded(branch) ? named : checkPair(dir, branch)
}

function checkNaming(tokens, cwd) {
  const args = gitArgs(tokens)
  if (!args) return ALLOW
  const add = parseWorktreeAdd(args)
  if (add) return addEntryStep(checkAdd(add))
  const branch = parseBranchCreate(args)
  const inWorktree = String(cwd || '')
    .replace(/\\/g, '/')
    .includes(`${rules.dir}/`)
  return branch && inWorktree ? checkBranch(branch) : ALLOW
}

function checkBashNaming(command, cwd) {
  for (const segment of segments(command)) {
    const decision = checkNaming(tokenize(segment), cwd)
    if (decision.block) return decision
  }
  return ALLOW
}

/**
 * @param {{ toolName?: string, toolInput?: object, cwd?: string, isAgent?: boolean }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decideName({ toolName, toolInput = {}, cwd, isAgent }) {
  if (!isAgent) return ALLOW // human workflow — never guarded
  if (toolName === 'EnterWorktree') {
    // `path` re-enters an existing tree, which is also how a tree named before this guard keeps
    // working. Every other shape creates one, and none of them can be right (#1684).
    if (toolInput.path) return ALLOW
    return refuseName(
      'EnterWorktree names the branch `worktree-<name>`, and its name cannot hold a `#`, so no ' +
        `tree it creates can sit on ${rules.branchShape}. ${twoStep()}`,
    )
  }
  if (toolName === 'Bash' && typeof toolInput.command === 'string') {
    return checkBashNaming(toolInput.command, cwd)
  }
  return ALLOW
}
