#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the worktree guardrail hook, run via `bun run test:hooks`.
// Mirrors the git-push guardrail pattern: soften the script and this test
// together, never one alone.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { decide } from './worktree-guard.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOOK = path.join(HERE, 'worktree-guard.mjs')
const ROOT = '/repo'
const WT = '/repo/.claude/worktrees/argo-42'

const agent = (extra) => ({ cwd: ROOT, projectDir: ROOT, isAgent: true, ...extra })
const blocks = (extra) => decide(agent(extra)).block
const bash = (command, extra) => blocks({ toolName: 'Bash', command, ...extra })

// ---------------------------------------------------------------------------
// Scope: the whole repository, not a chosen corner of it. The four files that
// sat uncommitted in the main checkout were under apps/, scripts/ and the root.
// ---------------------------------------------------------------------------
check('blocks apps/ edit in main checkout', () =>
  assert.equal(blocks({ filePath: 'apps/desktop/src/x.ts' }), true),
)
check('blocks packages/ (incl. skill authoring) in main checkout', () =>
  assert.equal(blocks({ filePath: 'packages/argo-skills/skills/ship/SKILL.md' }), true),
)
check('blocks an absolute apps/ path in main checkout', () =>
  assert.equal(blocks({ filePath: `${ROOT}/apps/desktop/src/x.ts` }), true),
)
check('blocks scripts/ in main checkout', () =>
  assert.equal(blocks({ filePath: 'scripts/hang-sample.sh' }), true),
)
check('blocks a root file in main checkout', () =>
  assert.equal(blocks({ filePath: 'package.json' }), true),
)
check('blocks docs/ in main checkout — no unguarded corner', () =>
  assert.equal(blocks({ filePath: 'docs/agents/worktrees.md' }), true),
)
check('blocks .claude/ config in main checkout', () =>
  assert.equal(blocks({ filePath: '.claude/settings.json' }), true),
)
check('blocks a notebook path in main checkout', () =>
  assert.equal(blocks({ filePath: 'notebooks/x.ipynb' }), true),
)

// A consumer that narrows the scope still gets the old behaviour.
check('honours a narrowed roots list', () => {
  assert.equal(blocks({ filePath: 'docs/x.md', roots: ['apps'] }), false)
  assert.equal(blocks({ filePath: 'apps/x.ts', roots: ['apps'] }), true)
})

// ---------------------------------------------------------------------------
// Bash: a write through the shell is a write. This is the hole the four files
// walked through — the guard watched Edit and Write only. Which paths a command
// line writes is shell-writes.mjs's job and shell-writes.test.mjs's to enforce;
// what is checked here is that the guard judges them by the same rule as a file
// path, and that a write outside the main checkout still passes.
// ---------------------------------------------------------------------------
check('blocks a heredoc redirect into the main checkout', () =>
  assert.equal(bash("cat > scripts/hang-sample.sh <<'EOF'\nhi\nEOF"), true),
)
check('blocks apply_patch run from the main checkout', () =>
  assert.equal(bash("apply_patch <<'PATCH'\n*** Begin Patch\nPATCH"), true),
)
check('allows a read-only command', () => assert.equal(bash('grep -r x apps/'), false))
check('allows a redirect to /dev/null', () =>
  assert.equal(bash('swift build > /dev/null 2>&1'), false),
)
check('allows a redirect outside the repo', () =>
  assert.equal(bash('echo x > /tmp/scratch/notes.txt'), false),
)
check('allows a write into a worktree from the main checkout', () =>
  assert.equal(bash(`echo x > ${WT}/apps/x.ts`), false),
)
check('allows any write when cwd is a worktree', () =>
  assert.equal(bash('echo x > package.json', { cwd: WT }), false),
)
check('allows a target this hook cannot expand', () =>
  assert.equal(bash('echo x > "$TMPDIR/log"'), false),
)

// ---------------------------------------------------------------------------
// Allowed: inside a worktree, outside the repo, and the human's own workflow.
// ---------------------------------------------------------------------------
check('allows apps/ edit when cwd is a worktree', () =>
  assert.equal(blocks({ filePath: 'apps/desktop/src/x.ts', cwd: WT }), false),
)
check('allows an absolute worktree path even from main cwd', () =>
  assert.equal(blocks({ filePath: `${WT}/packages/argo-skills/x.ts` }), false),
)
check('allows a path outside the project tree', () =>
  assert.equal(blocks({ filePath: '/somewhere/else/apps/x.ts' }), false),
)
check('never guards the human workflow (no CLAUDECODE)', () =>
  assert.equal(
    decide({ filePath: 'apps/desktop/src/x.ts', cwd: ROOT, projectDir: ROOT, isAgent: false })
      .block,
    false,
  ),
)
check('ignores a tool call with no file path', () =>
  assert.equal(blocks({ filePath: undefined }), false),
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

// End-to-end: the same for a Bash write, the hole this guard grew to cover.
check('script emits deny JSON for a blocked Bash write', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: "cat > scripts/x.sh <<'EOF'\nhi\nEOF" },
      cwd: ROOT,
    }),
    env: { ...process.env, CLAUDECODE: '1', CLAUDE_PROJECT_DIR: ROOT },
    encoding: 'utf8',
  })
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny')
})

// End-to-end (cross-CLI): the injected ARGO_HOOK_AGENT marker gates a block even
// without CLAUDECODE — this is how the guard fires under Codex, whose hooks the
// projection wires with ARGO_HOOK_AGENT=1 (no CLAUDECODE equivalent exists).
check('script blocks via ARGO_HOOK_AGENT when CLAUDECODE is absent', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      // Codex sends toolInput (camelCase); the guard must read it too.
      toolInput: { file_path: 'apps/desktop/src/x.ts' },
      cwd: ROOT,
    }),
    env: { ...process.env, CLAUDECODE: '', ARGO_HOOK_AGENT: '1', CLAUDE_PROJECT_DIR: ROOT },
    encoding: 'utf8',
  })
  const parsed = JSON.parse(out)
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny')
})

// End-to-end: an allowed edit produces no output (silent allow).
check('script stays silent for an allowed edit', () => {
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: `${WT}/docs/x.md` },
      cwd: ROOT,
    }),
    env: { ...process.env, CLAUDECODE: '1', CLAUDE_PROJECT_DIR: ROOT },
    encoding: 'utf8',
  })
  assert.equal(out.trim(), '')
})

report('worktree-guard')
