// WHICH worktree the work runs in: a tree is named at creation, the one moment the name is still
// free to change. The other half of the same rule, WHERE the work runs, is worktree-guard.mts,
// and that file is the hook. This one is a module it imports, not a second hook. The split across
// two files is a file-length one and carries no behaviour of its own.
//
// Nothing about editing inside an existing tree is guarded here, so a tree already named
// off-convention drains rather than breaks (#901). `EnterWorktree` cannot reach the convention by
// any input, so only its `path:` passes (#1684).
//
// decideName() is pure string logic: no fs, no git.
// The convention and what parses it: docs/agents/worktrees.md.

import type { Verdict, WorktreeGuardConfiguration } from './hook-io.mts'
import { ALLOW } from './hook-io.mts'
import { segments, tokenize, unexpanded } from './shell-commands.mts'
import type { WorktreeAdd } from './worktree-add-parse.mts'
import { gitArgs, parseBranchCreate, parseWorktreeAdd } from './worktree-add-parse.mts'
import { NAMELESS, SLUG, twoStepMessage } from './worktree-slug.mts'

// The convention belongs to the project, not to this file. `worktreeGuard.branchPrefix` in
// hooks.json is what turns the naming half on: a project that has declared no branch convention
// has none to enforce, and a guard that invented one would refuse every name that project
// already uses. Unconfigured, this half checks only that a new tree lands under `dir`, which is
// the edit guard's and the reaper's one real requirement.
// Only the keys with a non-empty default live here; `branchPrefix` and `docs` default to the
// empty string at their one reader, which is what turns the naming half off.
export const DEFAULTS: { dir: string; publishBranches: string[] } = {
  dir: '.claude/worktrees',
  publishBranches: [],
}

/** The convention in force, compiled once from the descriptor. */
export type NamingRules = {
  dir: string
  named: boolean
  tree: string
  publish: RegExp[]
  branchShape: string
  dirRe: RegExp
  branchRe: RegExp
  how: string
  enter: string
}

const literalRe = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function namingRules(config: WorktreeGuardConfiguration = {}): NamingRules {
  const dir = config.dir || DEFAULTS.dir
  const prefix = config.branchPrefix || ''
  const cite = config.docs ? ` Full rules: ${config.docs}.` : ''
  const named = Boolean(prefix)
  const tree = named ? 'ticket-<N>-<slug>' : '<name>'

  return {
    dir,
    named,
    tree,
    // Namespaces that publish rather than carry work: a design page, an evidence branch. They
    // join to no ticket by construction, so the ticket-join rule below would refuse every one.
    // The shape still applies inside the namespace, or `design/anything` is the way to dodge
    // the whole rule — and `design/2024-refresh` is then a page the reaper reads as issue #2024.
    publish: (config.publishBranches || DEFAULTS.publishBranches).map(
      (p: string) => new RegExp(String.raw`^${literalRe(p)}(?:#\d+-${SLUG}|${NAMELESS})$`),
    ),
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
export function configureNaming(config: WorktreeGuardConfiguration): NamingRules {
  rules = namingRules(config)
  return rules
}

const twoStep = (name: string): string => twoStepMessage(name, rules)

const refuseName = (what: string): Verdict => ({ block: true, reason: `${what} ${rules.how}` })

const addEntryStep = (decision: Verdict): Verdict =>
  decision.block ? { ...decision, reason: `${decision.reason} ${rules.enter}` } : decision

const directoryName = (dir: string): string =>
  dir.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() ?? ''

function checkDirectory(dir: string): Verdict {
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

const isPublish = (branch: string): boolean => rules.publish.some((shape) => shape.test(branch))

function checkBranch(branch: string): Verdict {
  if (!rules.named || unexpanded(branch) || rules.branchRe.test(branch)) return ALLOW
  if (isPublish(branch)) return ALLOW
  return refuseName(`"${branch}" is not a branch name this repo can join to a ticket.`)
}

// The two names differ only in prefix, so a matching pair is the whole point: a number in one
// and not the other is how `885-screenshot-pid-scope` happened.
const stem = (name: string): string =>
  name
    .replace(/^ticket-/, '')
    .replace(new RegExp(`^${literalRe(rules.branchShape.split('#')[0] ?? '')}#?`), '')

function checkPair(dir: string, branch: string): Verdict {
  if (stem(directoryName(dir)) === stem(branch)) return ALLOW
  return refuseName(
    `Directory "${directoryName(dir)}" and branch "${branch}" do not share one <N>-<slug> stem.`,
  )
}

function checkAdd({ dir, branch }: WorktreeAdd): Verdict {
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

function checkNaming(tokens: string[], cwd: string | undefined): Verdict {
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

function checkBashNaming(command: string, cwd: string | undefined): Verdict {
  for (const segment of segments(command)) {
    const decision = checkNaming(tokenize(segment), cwd)
    if (decision.block) return decision
  }
  return ALLOW
}

export function decideName({
  toolName,
  toolInput = {},
  cwd,
  isAgent,
}: {
  toolName?: string | undefined
  toolInput?: Record<string, unknown>
  cwd?: string | undefined
  isAgent?: boolean | undefined
}): Verdict {
  if (!isAgent) return ALLOW // human workflow — never guarded
  if (toolName === 'EnterWorktree') {
    // `path` re-enters an existing tree, which is also how a tree named before this guard keeps
    // working. Every other shape creates one, and none of them can be right (#1684).
    if (toolInput.path) return ALLOW
    return refuseName(
      'EnterWorktree names the branch `worktree-<name>`, and its name cannot hold a `#`, so no ' +
        `tree it creates can sit on ${rules.branchShape}. ${twoStep(String(toolInput.name ?? ''))}`,
    )
  }
  if (toolName === 'Bash' && typeof toolInput.command === 'string') {
    return checkBashNaming(toolInput.command, cwd)
  }
  return ALLOW
}
