#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the worktree guardrail hook, run via `bun run test:hooks`.
// Mirrors the git-push guardrail pattern: soften the script and this test
// together, never one alone.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decide } from './worktree-guard.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOOK = path.join(HERE, 'worktree-guard.mjs')
const ROOT = '/repo'
const WT = '/repo/.claude/worktrees/argo-42'

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

const agent = (extra) => ({ cwd: ROOT, projectDir: ROOT, isAgent: true, ...extra })

// Blocked: implementation trees in the main checkout.
check('blocks apps/ edit in main checkout', () =>
  assert.equal(decide(agent({ filePath: 'apps/desktop/src/x.ts' })).block, true),
)
check('blocks packages/ (incl. skill authoring) in main checkout', () =>
  assert.equal(
    decide(agent({ filePath: 'packages/argo-skills/skills/ship/SKILL.md' })).block,
    true,
  ),
)
check('blocks an absolute apps/ path in main checkout', () =>
  assert.equal(decide(agent({ filePath: `${ROOT}/apps/desktop/src/x.ts` })).block, true),
)

// Allowed: docs / config / markdown in the main checkout.
check('allows docs/ in main checkout', () =>
  assert.equal(decide(agent({ filePath: 'docs/agents/worktrees.md' })).block, false),
)
check('allows root markdown in main checkout', () =>
  assert.equal(decide(agent({ filePath: 'README.md' })).block, false),
)
check('allows .claude/ config in main checkout', () =>
  assert.equal(decide(agent({ filePath: '.claude/settings.json' })).block, false),
)

// Allowed: anything inside a worktree (the isolation the hook is enforcing).
check('allows apps/ edit when cwd is a worktree', () =>
  assert.equal(decide(agent({ filePath: 'apps/desktop/src/x.ts', cwd: WT })).block, false),
)
check('allows an absolute worktree path even from main cwd', () =>
  assert.equal(decide(agent({ filePath: `${WT}/packages/argo-skills/x.ts` })).block, false),
)

// Allowed: out of scope.
check('allows a path outside the project tree', () =>
  assert.equal(decide(agent({ filePath: '/somewhere/else/apps/x.ts' })).block, false),
)
check('never guards the human workflow (no CLAUDECODE)', () =>
  assert.equal(
    decide({ filePath: 'apps/desktop/src/x.ts', cwd: ROOT, projectDir: ROOT, isAgent: false })
      .block,
    false,
  ),
)
check('ignores a tool call with no file path', () =>
  assert.equal(decide(agent({ filePath: undefined })).block, false),
)

// End-to-end: the wired script emits a PreToolUse deny for a blocked edit.
check('script emits deny JSON for a blocked edit', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'apps/desktop/src/x.ts' },
      cwd: ROOT,
    }),
    env: { ...process.env, CLAUDECODE: '1', CLAUDE_PROJECT_DIR: ROOT },
    encoding: 'utf8',
  })
  const parsed = JSON.parse(out)
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /worktree/)
})

// End-to-end: an allowed edit produces no output (silent allow).
check('script stays silent for an allowed edit', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'docs/x.md' },
      cwd: ROOT,
    }),
    env: { ...process.env, CLAUDECODE: '1', CLAUDE_PROJECT_DIR: ROOT },
    encoding: 'utf8',
  })
  assert.equal(out.trim(), '')
})

if (failures > 0) {
  console.error(`\nworktree-guard: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nworktree-guard: all checks passed')
