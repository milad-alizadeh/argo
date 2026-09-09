// The guards' behavioural suite. `node --test hooks/` — plain node scripts, not a workspace
// suite, which is why this sits outside the turbo `test` pipeline and has its own script.
//
// Every guard here is pure `decide()` logic reached through the same three questions: does it
// leave the human alone, does it refuse the shape it exists to refuse, and does it let the
// exempt shapes through. A guard with no test is a guard whose prose is the only thing anyone
// has read, which is exactly how `/ship` shipped unable to push (see the `ship/SKILL.md` case
// at the bottom).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { decide as decidePublish, SHIP_MARKER } from './pr-ownership-guard.mjs'
import { afterGitOptions, invocation, segments, tokenize, unexpanded } from './shell-commands.mjs'
import { configureNaming, decideName } from './worktree-names.mjs'

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

// --- pr-ownership-guard -----------------------------------------------------------------------

test('the human is never guarded', () => {
  assert.equal(
    decidePublish({ toolName: 'Bash', toolInput: { command: 'git push' }, isAgent: false }).block,
    false,
  )
})

test('an agent pushing a work branch is refused, and told how', () => {
  const decision = decidePublish(bash('git push -u origin HEAD'))
  assert.equal(decision.block, true)
  assert.match(decision.reason, /\/ship/)
  assert.match(decision.reason, new RegExp(SHIP_MARKER))
})

test('an agent opening a pull request is refused, under both spellings', () => {
  for (const action of ['create', 'new']) {
    assert.equal(decidePublish(bash(`gh pr ${action} --base main`)).block, true, action)
  }
})

test('the guard reads every segment, not just the first', () => {
  assert.equal(decidePublish(bash('git status && git push -u origin HEAD')).block, true)
})

test('the ship marker is the opt-out, and survives an rtk wrapper', () => {
  assert.equal(decidePublish(bash(`${SHIP_MARKER} git push -u origin HEAD`)).block, false)
  assert.equal(decidePublish(bash(`rtk ${SHIP_MARKER} gh pr create --base main`)).block, false)
})

test('a push that deletes a ref is not publishing work', () => {
  assert.equal(decidePublish(bash('git push origin --delete design/inbox')).block, false)
})

test('a push to a ref outside refs/heads is evidence, not a work branch', () => {
  // pixel-review's PNG evidence ref.
  assert.equal(
    decidePublish(bash('git push --force origin abc123:refs/evidence/issue-7')).block,
    false,
  )
})

test('an unexpanded refspec earns no opinion rather than a refusal', () => {
  assert.equal(decidePublish(bash('git push origin "$commit:$ref"')).block, false)
})

test('a git subcommand that is not push is left alone', () => {
  assert.equal(decidePublish(bash('git fetch origin')).block, false)
  assert.equal(decidePublish(bash('gh pr view 12 --json body')).block, false)
})

test('a non-Bash tool call is left alone', () => {
  assert.equal(decidePublish({ toolName: 'Read', toolInput: {}, isAgent: true }).block, false)
})

// --- worktree-names ---------------------------------------------------------------------------

test('EnterWorktree with a path re-enters an existing tree', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  assert.equal(
    decideName({
      toolName: 'EnterWorktree',
      toolInput: { path: '.claude/worktrees/x' },
      isAgent: true,
    }).block,
    false,
  )
})

test('EnterWorktree without a path cannot reach the convention, so it is refused', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  const decision = decideName({
    toolName: 'EnterWorktree',
    toolInput: { name: 'x' },
    isAgent: true,
  })
  assert.equal(decision.block, true)
  assert.match(decision.reason, /git worktree add/)
})

test('an on-convention worktree add passes', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  assert.equal(
    decideName(bash("git worktree add -b 'argo/#901-naming' .claude/worktrees/ticket-901-naming"))
      .block,
    false,
  )
})

test('an off-convention branch name is refused', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  assert.equal(
    decideName(bash('git worktree add -b fix-stuff .claude/worktrees/ticket-901-naming')).block,
    true,
  )
})

test('an unset branchPrefix stops the guard judging branch names at all', () => {
  // What a consumer who has declared no convention gets (AGENTS.md, Cross-CLI guardrail hooks).
  configureNaming({ dir: '.claude/worktrees' })
  assert.equal(
    decideName(bash('git worktree add -b fix-stuff .claude/worktrees/ticket-x')).block,
    false,
  )
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
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
