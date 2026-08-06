#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the push guardrail, run via `bun run test:hooks`.
// Every deny case below is a command this session actually ran against main before the rule
// existed. Soften the script and this test together, never one alone.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decide } from './push-guard.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOOK = path.join(HERE, 'push-guard.mjs')

let failures = 0
function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    console.error(`  FAIL ${name}\n       ${err.message}`)
  }
}

const agent = (command) => decide({ command, isAgent: true })

// Blocked: anything that lands on the default branch.
check('blocks git push origin main', () => assert.equal(agent('git push origin main').block, true))
check('blocks the branch:main refspec this session used', () =>
  assert.equal(agent('git push origin worktree-push-guard:main').block, true),
)
check('blocks HEAD:main', () => assert.equal(agent('git push origin HEAD:main').block, true))
check('blocks refs/heads/main', () =>
  assert.equal(agent('git push origin HEAD:refs/heads/main').block, true),
)
check('blocks a forced push to main', () =>
  assert.equal(agent('git push --force origin main').block, true),
)
check('blocks main hidden in a compound command', () =>
  assert.equal(agent('bun run quality && git push origin main').block, true),
)
check('blocks main behind a global flag', () =>
  assert.equal(agent('git -C /repo push origin main').block, true),
)

// Fails CLOSED: an unnamed destination may resolve to main through the upstream.
check('blocks a bare git push', () => assert.equal(agent('git push').block, true))
check('blocks git push origin with no refspec', () =>
  assert.equal(agent('git push origin').block, true),
)
check('says WHY an unnamed destination is refused', () =>
  assert.match(agent('git push').reason, /destination is not named/),
)

// Allowed: the PR path, and everything that is not a push.
check('allows pushing a working branch', () =>
  assert.equal(agent('git push -u origin worktree-push-guard').block, false),
)
check('allows a branch whose name merely contains main', () =>
  assert.equal(agent('git push origin maintenance-fix').block, false),
)
check('allows a src named main pushed to another branch', () =>
  assert.equal(agent('git push origin main:release-candidate').block, false),
)
check('allows gh pr create', () => assert.equal(agent('gh pr create --fill').block, false))
check('allows other git commands', () =>
  assert.equal(agent('git status && git log --oneline -1').block, false),
)
check('allows a non-default branch name from a master repo', () =>
  assert.equal(
    decide({ command: 'git push origin main', isAgent: true, defaultBranch: 'master' }).block,
    false,
  ),
)

// Never guards the human — the whole point of the split.
check('never guards a human', () =>
  assert.equal(decide({ command: 'git push origin main' }).block, false),
)

// End-to-end through the script.
check('script denies a real push payload', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push origin main' } }),
    env: { ...process.env, CLAUDECODE: '1' },
    encoding: 'utf8',
  })
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny')
})

check('script stays silent for a branch push', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git push -u origin worktree-push-guard' },
    }),
    env: { ...process.env, CLAUDECODE: '1' },
    encoding: 'utf8',
  })
  assert.equal(out.trim(), '')
})

if (failures > 0) {
  console.error(`\npush-guard: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\npush-guard: all checks passed')
