#!/usr/bin/env node
// PreToolUse(Bash) guardrail: `/ship` is the only skill that pushes a work branch or opens a
// pull request (#1669).
//
// This replaced a build-time scan that read the skills' own prose and asserted only ship/SKILL.md
// contained `gh pr create`. That scan could only ever be right about what a skill SAYS. A skill
// whose prose was clean still had nothing standing between it and the command, and prose drifts
// from behaviour in both directions. This stops the action instead.
//
// WHAT THIS HOOK CANNOT DO, and why the rule below is shaped the way it is.
//
// The rule everybody wants is "deny unless the running skill is ship". A PreToolUse hook cannot
// express it. Claude Code's PreToolUse payload carries session_id, transcript_path, cwd,
// permission_mode, hook_event_name, tool_name, tool_input, tool_use_id and the subagent fields,
// and not one of them names the active skill; no CLAUDE_* environment variable carries it
// either, and there is no on-disk "active skill" state a hook can read. The transcript at
// `transcript_path` does record tool calls, but it is written asynchronously and lags the turn
// in hand, so the Skill call that started the current work may simply not be in the file when
// this hook runs. Reading it would make the guard's verdict depend on a race.
//
// So the guard denies the action outright and takes an explicit, visible opt-out instead: a
// command carrying the `ARGO_SHIP=1` environment prefix passes. `ship/SKILL.md` writes that
// prefix into the commands it tells the agent to run, which makes the exemption a thing the
// command line SAYS rather than a thing the guard infers. Two properties follow, and they are
// the whole reason for the choice:
//   - It cannot be claimed by accident. Nothing types `ARGO_SHIP=1` while meaning something else.
//   - What claimed it is in the transcript, next to the command it exempted, so a wrong push is
//     auditable after the fact rather than invisible.
// It is emphatically not a security boundary: any agent that reads this file can write the
// prefix. It is a speed bump with a name on it, which is what a guardrail against an unthinking
// habit needs to be. AGENTS.md carries the rule itself, because a hook denies but cannot teach.
//
// Gated on an agent marker (CLAUDECODE, or ARGO_HOOK_AGENT for markerless harnesses like Codex)
// so it never touches the human's own workflow. decide() is pure string logic (no fs, no git).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALLOW, runGuard, underAgent } from './hook-io.mjs'
import { afterGitOptions, invocation, segments, tokenize, unexpanded } from './shell-commands.mjs'

// The opt-out. An environment assignment rather than a flag, because it survives being placed in
// front of any command and reads as what it is at the point of use.
export const SHIP_MARKER = 'ARGO_SHIP=1'

// `gh pr new` is a real alias of `gh pr create`, so both spellings open a pull request.
const PR_SUBCOMMANDS = ['create', 'new']

const HOW =
  `Opening the PR is \`/ship\`'s step, and only its own: it carries the close-out nothing else ` +
  `runs, the sweep for \`.only\` and debug prints, the rebase onto the current base, and the ` +
  `review findings written into the body. Finish on the branch with the work committed and let ` +
  `the caller invoke \`/ship\`. If you ARE \`/ship\`, prefix the command with ${SHIP_MARKER}: ` +
  `that marker is how this hook is told, because nothing in a hook's payload names the skill ` +
  `that is running.`

const refuse = (what) => ({ block: true, reason: `${what} ${HOW}` })

/** True when a `git push` refspec sends something that is not a branch. */
function pushesNonBranch(refspec) {
  // `:refs/heads/x` with an empty source deletes rather than publishes.
  if (refspec.startsWith(':')) return true
  const destination = refspec.slice(refspec.lastIndexOf(':') + 1)
  // A fully qualified ref that is not a branch: the PNG evidence ref pixel-review pushes, and
  // the tag or note shapes that are not work either.
  return destination.startsWith('refs/') && !destination.startsWith('refs/heads/')
}

const DELETE_FLAGS = ['--delete', '-d']

/** @returns {{ block: boolean, reason?: string }} */
function checkPush(args) {
  if (args.some((token) => DELETE_FLAGS.includes(token))) return ALLOW
  const operands = args.filter((token) => !token.startsWith('-'))
  // operands[0] is the remote; everything after it is a refspec.
  const refspecs = operands.slice(1)
  if (refspecs.some(unexpanded)) return ALLOW
  // Every refspec names something that is not a branch, so nothing here publishes work.
  if (refspecs.length > 0 && refspecs.every(pushesNonBranch)) return ALLOW
  return refuse("This pushes a work branch, and pushing is `/ship`'s step.")
}

function checkPublishing(tokens) {
  const { prefix, name, args } = invocation(tokens)
  // The explicit opt-out, read off the command line itself.
  if (prefix.includes(SHIP_MARKER)) return ALLOW
  if (name === 'gh') {
    const [subcommand, action] = args.filter((token) => !token.startsWith('-'))
    if (subcommand === 'pr' && PR_SUBCOMMANDS.includes(action)) {
      return refuse('This opens a pull request.')
    }
    return ALLOW
  }
  if (name === 'git') {
    const rest = afterGitOptions(args)
    if (rest[0] === 'push') return checkPush(rest.slice(1))
  }
  return ALLOW
}

/**
 * @param {{ toolName?: string, toolInput?: object, isAgent?: boolean }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({ toolName, toolInput = {}, isAgent }) {
  if (!isAgent) return ALLOW // human workflow — never guarded
  if (toolName !== 'Bash' || typeof toolInput.command !== 'string') return ALLOW
  for (const segment of segments(toolInput.command)) {
    const decision = checkPublishing(tokenize(segment))
    if (decision.block) return decision
  }
  return ALLOW
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGuard((payload) =>
    decide({
      // Claude sends tool_name/tool_input; Codex sends toolName/toolInput (camelCase).
      toolName: payload.tool_name ?? payload.toolName,
      toolInput: payload.tool_input ?? payload.toolInput ?? {},
      isAgent: underAgent(),
    }),
  )
}
