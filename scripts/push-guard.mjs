#!/usr/bin/env node
// PreToolUse(Bash) guardrail: an AGENT may not push to the default branch. Changes land through
// a pull request.
//
// GitHub's own branch protection cannot enforce this, and the reason is worth stating: an agent
// pushes with the repo owner's credentials, and the owner deliberately keeps `enforce_admins:
// false` so they can still hotfix. Server-side, the agent IS the admin. So the rule "the human
// may push directly, the agent may not" is not expressible as branch protection at all — it is a
// distinction only the local harness can draw, which is why it lives here.
//
// UNLIKE the placement guard, this one fails CLOSED. A command whose destination cannot be
// determined — a bare `git push`, an unreadable refspec — is denied rather than allowed, because
// the cost of a wrong allow (an unreviewed commit on main, already public) is not symmetric with
// the cost of a wrong deny (being told to name the branch). Ambiguity resolves toward the PR.
//
// Gated on an agent marker (CLAUDECODE, or ARGO_HOOK_AGENT for markerless harnesses like Codex)
// so the human's own workflow is never touched. Pure string logic — decide() is unit-tested.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FALLBACK_DEFAULT = 'main'

/** Split a shell line into the individual commands a `git push` could hide in. */
function segments(command) {
  return command.split(/&&|\|\||;|\n|\|/).map((part) => part.trim())
}

/** The tokens of a `git push …`, or null when this segment is not one. */
function pushArgs(segment) {
  const tokens = segment.split(/\s+/).filter(Boolean)
  const git = tokens.indexOf('git')
  if (git === -1) return null
  // Skip global flags (`git -C dir push`) to find the subcommand.
  const rest = tokens.slice(git + 1).filter((t) => t !== '--')
  const verb = rest.findIndex((t) => !t.startsWith('-') && !isFlagValue(rest, t))
  if (verb === -1 || rest[verb] !== 'push') return null
  return rest.slice(verb + 1)
}

// `git -C <dir> push` — the value after -C is not the subcommand.
function isFlagValue(tokens, token) {
  const i = tokens.indexOf(token)
  return i > 0 && ['-C', '-c', '--git-dir', '--work-tree'].includes(tokens[i - 1])
}

/**
 * @param {{ command?: string, isAgent?: boolean, defaultBranch?: string }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({ command, isAgent, defaultBranch = FALLBACK_DEFAULT }) {
  if (!isAgent || !command) return { block: false }

  for (const segment of segments(command)) {
    const args = pushArgs(segment)
    if (args === null) continue

    const positional = args.filter((a) => !a.startsWith('-'))
    // `git push`, `git push origin`, `git push --force` — destination comes from the branch's
    // upstream, which this hook cannot read reliably. Deny rather than guess.
    if (positional.length < 2) return { block: true, reason: explain(defaultBranch, segment, true) }

    // `<src>:<dst>` pushes to <dst>; a bare `<ref>` pushes to the same name.
    for (const refspec of positional.slice(1)) {
      const dst = (refspec.includes(':') ? refspec.split(':').pop() : refspec).replace(
        /^refs\/heads\//,
        '',
      )
      if (dst === defaultBranch) return { block: true, reason: explain(defaultBranch, segment) }
    }
  }
  return { block: false }
}

function explain(branch, segment, ambiguous = false) {
  const why = ambiguous
    ? `its destination is not named, so it may resolve to \`${branch}\` through the branch's upstream`
    : `it targets \`${branch}\``
  return (
    `Refusing \`${segment}\` — ${why}, and agent changes land through a pull request, never by ` +
    `pushing to the default branch.\n\n` +
    `Push the working branch and open a PR instead:\n` +
    `  git push -u origin <this-branch>\n` +
    `  gh pr create --fill\n\n` +
    `Then let the human review and merge it. The three required checks (lint · typecheck · unit, ` +
    `story tests, electron e2e) run on the PR — pushing to ${branch} skips them, which is the ` +
    `other half of why this is blocked.\n\n` +
    `This is not GitHub branch protection and cannot be: an agent pushes with the owner's ` +
    `credentials and the owner keeps their own admin bypass, so server-side the two are the same ` +
    `identity. The human may still push directly; this hook only ever sees the agent.`
  )
}

/** The repo's real default branch, so a fork or a `master` repo is not guarded against the wrong name. */
function resolveDefaultBranch(cwd) {
  try {
    const ref = execFileSync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return ref.split('/').pop() || FALLBACK_DEFAULT
  } catch {
    return FALLBACK_DEFAULT
  }
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
    return // Malformed payload — the harness is not asking about a push.
  }

  const cwd = payload.cwd || process.cwd()
  const command = payload.tool_input?.command ?? payload.toolInput?.command
  const decision = decide({
    command,
    defaultBranch: resolveDefaultBranch(cwd),
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
