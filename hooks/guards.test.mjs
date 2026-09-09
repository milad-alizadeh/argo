// The guards' behavioural suite. `node --test hooks/` — plain node scripts, not a workspace
// suite, which is why this sits outside the turbo `test` pipeline and has its own script.
//
// This file carries the shell-command parsing every guard is built on, and the one regression
// the suite exists for. The guards themselves are in pr-ownership.test.mjs and
// worktree-names.test.mjs, split off on file length alone.
//
// A guard with no test is a guard whose prose is the only thing anyone has read, which is
// exactly how `/ship` shipped unable to push (see the `ship/SKILL.md` case at the bottom).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { decide as decidePublish } from './pr-ownership-guard.mjs'
import { afterGitOptions, invocation, segments, tokenize, unexpanded } from './shell-commands.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const bash = (command) => ({ toolName: 'Bash', toolInput: { command }, isAgent: true })

// --- shell-commands ---------------------------------------------------------------------------

test('segments splits on every shell separator a command line can carry', () => {
  assert.deepEqual(
    segments('cd x && git push ; gh pr create | tee').map((s) => s.trim()),
    ['cd x', 'git push', 'gh pr create', 'tee'],
  )
})

test('segments drops a heredoc body, which is data the shell never runs', () => {
  // Tracked files in this repo quote guarded commands inside heredocs; reading one as an
  // invocation denies any session rewriting the docs that describe the rule.
  assert.deepEqual(segments("cat <<'EOF'\ngit push -u origin HEAD\nEOF").length, 1)
})

test('invocation returns the environment prefix rather than skipping it', () => {
  assert.deepEqual(invocation(tokenize('rtk ARGO_SHIP=1 git push')), {
    prefix: ['rtk', 'ARGO_SHIP=1'],
    name: 'git',
    args: ['push'],
  })
})

test("afterGitOptions steps over git's own options to reach the subcommand", () => {
  assert.deepEqual(afterGitOptions(['-C', '/tmp/x', '--no-pager', 'push', 'origin']), [
    'push',
    'origin',
  ])
})

test('unexpanded flags a token this file cannot resolve', () => {
  assert.equal(unexpanded('$BRANCH'), true)
  assert.equal(unexpanded('`git rev-parse HEAD`'), true)
  assert.equal(unexpanded('main'), false)
})

// --- the regression this suite exists for -------------------------------------------------------

test('every command ship/SKILL.md tells the agent to run survives its own guard', () => {
  // hooks.json, pr-ownership-guard.mjs and AGENTS.md all assert that ship/SKILL.md writes the
  // marker into its own commands. Nothing checked it, and for a while it did not: the skill that
  // owns pushing could not push. This reads the skill and runs what it says.
  const skill = readFileSync(
    path.join(repoRoot, 'packages/argo-skills/skills/ship/SKILL.md'),
    'utf8',
  )
  const RUNNABLE = /^(?:\w+=\S+\s+)*(?:rtk\s+)?(?:git push|gh pr create)\b/
  const commands = [...skill.matchAll(/`([^`\n]*)`/g)]
    .map((match) => match[1].trim())
    // A span that only NAMES the command is prose, not an instruction: step 7 says what to do
    // "when `gh pr create` exits non-zero". Only a span that opens with the invocation and
    // carries arguments is something the skill is telling the agent to run.
    .filter((span) => RUNNABLE.test(span) && span.split(/\s+/).length > 3)
    .concat(
      // The fenced block that carries `gh pr create` is not inside backticks.
      skill
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^(?:\w+=\S+\s+)*gh pr create\b/.test(line)),
    )

  assert.ok(commands.length >= 3, `expected the push and PR commands, found ${commands.length}`)
  for (const command of commands) {
    assert.equal(
      decidePublish(bash(command)).block,
      false,
      `ship/SKILL.md tells the agent to run a command its own guard refuses: ${command}`,
    )
  }
})
