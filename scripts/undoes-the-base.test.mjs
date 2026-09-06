#!/usr/bin/env node
// Tests for `scripts/undoes-the-base.sh` (#1558).
//
// The deletion rule is exercised end-to-end through `land.sh` in `land.test.mjs`. The revert
// rule is exercised HERE, against hand-made refs, and the reason is worth stating: a clean
// rebase cannot produce a tree whose file matches a state the base has moved past. If the
// branch's diff for that file is empty the rebase leaves the base's own content; if it is not
// empty and touches what the base touched, the rebase conflicts and `land.sh` refuses it
// already. So the rule reads a shape that reaches `main` by squash-merge or by a lane's own
// force-pushed conflict resolution — and testing it through `land.sh` would mean faking a
// rebase that git does not perform.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = path.join(ROOT, 'scripts/undoes-the-base.sh')

// A repository holding one file through three states, and a `result` commit the caller shapes.
// Returns the refs the script takes plus a runner over them.
function repo({ resultContent, resultMessage = 'the work' }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'undoes-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe', encoding: 'utf8' })
  const write = (name, body) => writeFileSync(path.join(dir, name), body)

  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')

  write('moving.txt', 'v1\n')
  write('steady.txt', 'unchanged\n')
  git('add', '-A')
  git('commit', '-qm', 'the cut')
  const cut = git('rev-parse', 'HEAD').trim()

  // The base moves on, retiring v1.
  write('moving.txt', 'v2\n')
  git('add', '-A')
  git('commit', '-qm', 'the base moved on')
  const base = git('rev-parse', 'HEAD').trim()

  write('moving.txt', resultContent)
  git('add', '-A')
  // --allow-empty: one case writes back the content the base already holds, and that commit
  // having no diff is the point of it.
  git('commit', '-q', '--allow-empty', '-m', resultMessage)

  const run = () => {
    try {
      const stdout = execFileSync('sh', [SCRIPT, dir, base, cut, 'HEAD'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      return { status: 0, output: stdout }
    } catch (error) {
      return { status: error.status, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }
    }
  }
  return { run, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

check('content the base has moved past is reported', () => {
  const r = repo({ resultContent: 'v1\n' })
  const result = r.run()
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /^reverted moving\.txt$/m)
  r.cleanup()
})

check('content the base has never held is not reported', () => {
  const r = repo({ resultContent: 'v3\n' })
  const result = r.run()
  assert.equal(result.status, 0, result.output)
  assert.equal(result.output.trim(), '')
  r.cleanup()
})

// The base's CURRENT state is excluded, which is what keeps every file a branch left alone off
// the report: after a clean rebase those read the base's own blob.
check('the state the base holds now is not a revert', () => {
  const r = repo({ resultContent: 'v2\n' })
  const result = r.run()
  assert.equal(result.status, 0, result.output)
  r.cleanup()
})

check('a revert the branch declares by path is silent', () => {
  const r = repo({
    resultContent: 'v1\n',
    resultMessage: 'the work\n\nReverts-file: moving.txt',
  })
  const result = r.run()
  assert.equal(result.status, 0, result.output)
  r.cleanup()
})

// One line for a change that undoes a whole window on purpose, which is what a repair of a bad
// merge is. It is deliberately visible in the log for ever.
check('a wholesale revert can be declared with a star', () => {
  const r = repo({ resultContent: 'v1\n', resultMessage: 'the repair\n\nReverts-file: *' })
  const result = r.run()
  assert.equal(result.status, 0, result.output)
  r.cleanup()
})

check('a trailer for another path does not excuse this one', () => {
  const r = repo({
    resultContent: 'v1\n',
    resultMessage: 'the work\n\nReverts-file: steady.txt',
  })
  const result = r.run()
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /^reverted moving\.txt$/m)
  r.cleanup()
})

report('undoes-the-base')
