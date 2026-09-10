// The rules guard's behavioural suite. `node --test hooks/` — plain node scripts, not a
// workspace suite, which is why this sits outside the turbo `test` pipeline.
//
// What a `paths:` glob covers is rule-paths.test.mjs; this is what the guard does about it. The
// cases that matter most are the ones where it must stay QUIET, because a guard that denies too
// much is a guard the next session removes.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decide, sentenceList, withoutWorktreePrefix, writtenPaths } from './rules-guard.mjs'

const ROOT = '/repo'
const RULES = [
  { name: 'desktop.md', globs: ['apps/desktop/**'] },
  { name: 'house.md', globs: ['**'] },
  { name: 'swift.md', globs: ['apps/macOS/**/*.swift'] },
]

const call = (toolName, toolInput, extra = {}) => ({
  toolName,
  toolInput,
  cwd: ROOT,
  projectDir: ROOT,
  isAgent: true,
  rules: RULES,
  ...extra,
})

const edit = (filePath, extra) => call('Edit', { file_path: filePath }, extra)
const bash = (command, extra) => call('Bash', { command }, extra)

// --- what it denies ---------------------------------------------------------------------------

test('the first edit under a rule is denied, and the message names the file', () => {
  const decision = decide(edit('apps/desktop/src/main.ts'))
  assert.equal(decision.block, true)
  assert.match(decision.reason, /rules\/desktop\.md/)
  assert.match(decision.reason, /rules\/house\.md/)
  assert.deepEqual(decision.rules, ['desktop.md', 'house.md'])
})

test('the second edit under the same rules passes, so the cost is one call per rule', () => {
  const seen = decide(edit('apps/desktop/src/main.ts')).rules
  assert.deepEqual(decide(edit('apps/desktop/src/other.ts', { seen })), { block: false })
})

test('a rule the session has not been told about still denies after another one has', () => {
  const decision = decide(edit('apps/macOS/App.swift', { seen: ['house.md'] }))
  assert.equal(decision.block, true)
  assert.deepEqual(decision.rules, ['swift.md'])
})

test('an absolute path is judged the same as a relative one', () => {
  assert.equal(decide(edit('/repo/apps/desktop/src/main.ts')).block, true)
})

test('a NotebookEdit reaches the guard through its own path field', () => {
  const decision = decide(call('NotebookEdit', { notebook_path: 'apps/desktop/notes.ipynb' }))
  assert.equal(decision.block, true)
})

// --- the Bash half ----------------------------------------------------------------------------

test('a Bash redirection is a write, which is how several harnesses edit a file', () => {
  const decision = decide(bash('cat > apps/desktop/src/x.ts <<EOF\nconst a = 1\nEOF'))
  assert.equal(decision.block, true)
  assert.deepEqual(decision.rules, ['desktop.md', 'house.md'])
})

test('an in-place edit through sed is a write', () => {
  assert.equal(decide(bash("sed -i '' 's/a/b/' apps/macOS/App.swift")).block, true)
})

test('a Bash command that reads and writes nothing passes', () => {
  assert.deepEqual(decide(bash('cat apps/desktop/src/x.ts')), { block: false })
})

test('a target this hook cannot expand passes rather than denying a guess', () => {
  assert.deepEqual(decide(bash('cat > "$OUT/x.ts"')), { block: false })
  // apply_patch names its paths inside a heredoc, so it resolves to the directory itself.
  assert.deepEqual(decide(bash('apply_patch')), { block: false })
})

// --- where it stays quiet ---------------------------------------------------------------------

test('the human is never guarded', () => {
  assert.deepEqual(decide(edit('apps/desktop/src/main.ts', { isAgent: false })), { block: false })
})

test('a project with no rules gets no judgement at all', () => {
  assert.deepEqual(decide(edit('apps/desktop/src/main.ts', { rules: [] })), { block: false })
})

test('a file outside the project tree is not ours to guard', () => {
  assert.deepEqual(decide(edit('/tmp/scratch/x.ts')), { block: false })
  assert.deepEqual(decide(edit('../elsewhere/x.ts')), { block: false })
})

// --- the worktree, where every change in this repository runs -----------------------------------

test('a worktree path is matched against the tree it is inside', () => {
  // CLAUDE_PROJECT_DIR often still names the main checkout, so the path arrives with the
  // worktree prefix on it. Without stripping that, `apps/desktop/**` matches nothing and the
  // guard is silent in the only place work ever happens.
  const inside = '.claude/worktrees/ticket-42/apps/desktop/src/main.ts'
  assert.equal(withoutWorktreePrefix(inside), 'apps/desktop/src/main.ts')
  assert.equal(decide(edit(inside)).block, true)
})

test('a file at the root of a worktree still takes the whole-repository rule', () => {
  const decision = decide(edit('.claude/worktrees/ticket-42/README.md'))
  assert.deepEqual(decision.rules, ['house.md'])
})

// --- the message ------------------------------------------------------------------------------

test('sentenceList joins the way English does, not the way join() does', () => {
  assert.equal(sentenceList(['a']), 'a')
  assert.equal(sentenceList(['a', 'b']), 'a and b')
  assert.equal(sentenceList(['a', 'b', 'c']), 'a, b and c')
})

test('the deny message agrees in number with the rules it names', () => {
  assert.match(decide(edit('README.md')).reason, /nothing loads that rule for you/)
  assert.match(decide(edit('apps/desktop/x.ts')).reason, /nothing loads those rules for you/)
})

test('writtenPaths prefers the editor field and falls back to the command', () => {
  assert.deepEqual(writtenPaths({ toolName: 'Write', toolInput: { file_path: 'a.ts' } }), ['a.ts'])
  assert.deepEqual(writtenPaths({ toolName: 'Bash', toolInput: { command: 'touch a.ts b.ts' } }), [
    'a.ts',
    'b.ts',
  ])
})
