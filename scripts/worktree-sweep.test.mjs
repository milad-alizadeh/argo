#!/usr/bin/env node
// Tests for `scripts/worktree-gc.sh --artifacts`, the build-output sweep (#1377).
//
// This is the most destructive thing in the repo: it runs `rm -rf` over directories inside
// worktrees that other sessions are working in, and its only protection is one liveness probe.
// The first version of that probe was wrong in the dangerous direction — `find -maxdepth 0`
// stats the root of the tree, whose mtime does not move while a compiler rewrites files deep
// inside it, so a build forty minutes in read as quiet. Every case below is about the probe.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GC = path.join(ROOT, 'scripts/worktree-gc.sh')

const HOURS_AGO = (n) => new Date(Date.now() - n * 3600_000)

// A repository whose `.claude/worktrees` holds one worktree with build output in it. Every
// file is aged an hour by default, so a case makes something live by touching it back.
function scenario({ worktree = 'ticket-1-a' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sweep-'))
  execFileSync('git', ['init', '-q', '-b', 'main', dir], { stdio: 'pipe' })
  mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  writeFileSync(path.join(dir, 'scripts/worktree-gc.sh'), execFileSync('cat', [GC]))

  const wt = path.join(dir, '.claude/worktrees', worktree)
  const derived = path.join(wt, 'apps/macOS/build')
  const scratch = path.join(wt, 'apps/macOS/Packages/ArgoUI/.build')
  const deep = path.join(scratch, 'arm64-apple-macosx/debug/Modules')
  mkdirSync(derived, { recursive: true })
  mkdirSync(deep, { recursive: true })
  const files = [
    path.join(derived, 'product.o'),
    path.join(scratch, 'build.db'),
    path.join(deep, 'ArgoUI.swiftmodule'),
  ]
  for (const f of files) writeFileSync(f, 'x')
  const age = (target, when) => utimesSync(target, when, when)
  // Everything under the worktree, files and directories alike, an hour old. Every entry
  // matters: the probe searches the tree, so one freshly created intermediate directory is
  // enough to hold the whole worktree — which is the conservative answer, and not the one
  // these cases are about.
  const ageTree = (root, when) => {
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      age(path.join(entry.parentPath ?? entry.path, entry.name), when)
    }
    age(root, when)
  }
  ageTree(wt, HOURS_AGO(1))

  const run = (args) => {
    const result = execFileSync('sh', [path.join(dir, 'scripts/worktree-gc.sh'), ...args], {
      cwd: dir,
      encoding: 'utf8',
    })
    return result
  }
  return {
    dir,
    derived,
    scratch,
    deep,
    age,
    run,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

check('a quiet worktree has its build output swept', () => {
  const s = scenario()
  const out = s.run(['--artifacts'])
  assert.match(out, /swept ticket-1-a/, out)
  assert.ok(!existsSync(s.derived), 'DerivedData should be gone')
  assert.ok(!existsSync(s.scratch), 'the scratch path should be gone')
  s.cleanup()
})

check('--dry-run deletes nothing', () => {
  const s = scenario()
  const out = s.run(['--artifacts', '--dry-run'])
  assert.match(out, /sweep ticket-1-a .*\(dry run\)/, out)
  assert.ok(existsSync(s.derived), 'a dry run must not delete')
  assert.ok(existsSync(s.scratch))
  s.cleanup()
})

// The case the first version got wrong. A build that has been running for a while writes deep
// inside a directory structure whose shape stopped changing in the first minute, so the root
// of the tree looks untouched while the compiler is very much inside it.
check('a build writing deep inside a tree is held, not swept', () => {
  const s = scenario()
  s.age(path.join(s.deep, 'ArgoUI.swiftmodule'), new Date())
  const out = s.run(['--artifacts'])
  assert.match(out, /hold ticket-1-a/, out)
  assert.ok(existsSync(s.scratch), 'a live build must not be deleted under')
  assert.ok(existsSync(s.derived), 'and neither must its sibling in the same worktree')
  s.cleanup()
})

check('a recently written DerivedData holds the worktree too', () => {
  const s = scenario()
  s.age(path.join(s.derived, 'product.o'), new Date())
  const out = s.run(['--artifacts'])
  assert.match(out, /hold ticket-1-a/, out)
  assert.ok(existsSync(s.derived))
  s.cleanup()
})

// A worktree with a space in its path: the target list is the argument to `rm -rf`, and a
// space-joined string would be word-split into two paths that name nothing.
check('a worktree whose path contains a space is swept, and only it', () => {
  const s = scenario({ worktree: 'ticket-2 with space' })
  const out = s.run(['--artifacts'])
  assert.match(out, /swept ticket-2 with space/, out)
  assert.ok(!existsSync(s.scratch))
  // The worktree itself is never the target — only the build output inside it.
  assert.ok(existsSync(path.join(s.dir, '.claude/worktrees/ticket-2 with space')))
  s.cleanup()
})

check('the worktree itself, and its sources, are never touched', () => {
  const s = scenario()
  const source = path.join(
    s.dir,
    '.claude/worktrees/ticket-1-a/apps/macOS/Packages/ArgoUI/keep.swift',
  )
  writeFileSync(source, 'let keep = 1\n')
  s.run(['--artifacts'])
  assert.ok(existsSync(source), 'the sweep is of build output, not of work')
  s.cleanup()
})

check('an unknown option is refused rather than guessed at', () => {
  const s = scenario()
  let status = 0
  try {
    s.run(['--artefacts'])
  } catch (err) {
    status = err.status
  }
  assert.equal(status, 2, 'a misspelt flag must not fall through to the reaping sweep')
  assert.ok(existsSync(s.derived))
  s.cleanup()
})

report('worktree sweep')
