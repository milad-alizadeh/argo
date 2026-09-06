#!/usr/bin/env node
// Tests for the DESIGN-BRANCH sweep in `scripts/worktree-gc.sh` (#1526).
//
// A design's explorable page never lands on the default branch: it lives on `design/<screen>`
// for as long as the screen is being built, and the design `.md` on the default branch is what
// names it. This sweep is what deletes the branch afterwards, so nobody has to remember to.
// `worktree-sweep.test.mjs` is the other half of this script, the `--artifacts` sweep.
//
// The burden here is a deletion's, not a cache's: every case asks whether a branch that must
// SURVIVE does. A wrong reap destroys the only copy of a page a screen is still being built
// against, and it looks exactly like a tidy-up.
//
// The four ways a reap would be wrong, each a case below: the epic is still open, the `.md`
// names no epic, the issue query failed, and the branch is one no design claims. The fixture is
// `worktree-gc.designs.harness.mjs`.
import assert from 'node:assert/strict'
import { check, report } from './check-harness.mjs'
import { scenario } from './worktree-gc.designs.harness.mjs'

check('a design branch whose epic has closed is reaped', () => {
  const s = scenario({
    designs: { 'a-screen.md': { explorable: 'design/a-screen', epic: 700 } },
    issues: { 700: 'CLOSED' },
  })
  s.branch('design/a-screen')
  assert.ok(
    s.remoteBranches().includes('design/a-screen'),
    'the fixture must start with the branch',
  )
  const out = s.run()
  assert.match(out, /reaped design\/a-screen/)
  assert.ok(!s.remoteBranches().includes('design/a-screen'), out)
  s.cleanup()
})

check('a design branch whose epic is still open survives', () => {
  const s = scenario({
    designs: { 'a-screen.md': { explorable: 'design/a-screen', epic: 700 } },
    issues: { 700: 'OPEN' },
  })
  s.branch('design/a-screen')
  const out = s.run()
  assert.match(out, /keep design\/a-screen — epic #700 is OPEN/)
  assert.ok(s.remoteBranches().includes('design/a-screen'), out)
  s.cleanup()
})

check('a design that names no epic keeps its branch', () => {
  const s = scenario({
    designs: { 'a-screen.md': { explorable: 'design/a-screen' } },
    issues: {},
  })
  s.branch('design/a-screen')
  const out = s.run()
  assert.match(out, /keep design\/a-screen — .* names no epic/)
  assert.ok(s.remoteBranches().includes('design/a-screen'), out)
  s.cleanup()
})

check('an unreadable issue keeps the branch', () => {
  // The stub exits 1 for 700, which is what a network failure or a revoked token looks like
  // from here. Incomplete information is not a reason to delete anything.
  const s = scenario({
    designs: { 'a-screen.md': { explorable: 'design/a-screen', epic: 700 } },
    issues: {},
  })
  s.branch('design/a-screen')
  const out = s.run()
  assert.match(out, /keep design\/a-screen — epic #700 is unreadable/)
  assert.ok(s.remoteBranches().includes('design/a-screen'), out)
  s.cleanup()
})

check('a design/ branch no design claims is never touched', () => {
  // The join runs from the `.md`, not from the branch namespace: a branch somebody pushed by
  // hand has no epic to read, so the sweep must not reason about it at all.
  const s = scenario({
    designs: { 'a-screen.md': { explorable: 'design/a-screen', epic: 700 } },
    issues: { 700: 'CLOSED' },
  })
  s.branch('design/a-screen')
  s.branch('design/unclaimed')
  const out = s.run()
  assert.ok(!s.remoteBranches().includes('design/a-screen'), out)
  assert.ok(s.remoteBranches().includes('design/unclaimed'), out)
  s.cleanup()
})

check('a design naming a branch that is already gone reaps nothing and says nothing', () => {
  const s = scenario({
    designs: { 'a-screen.md': { explorable: 'design/a-screen', epic: 700 } },
    issues: { 700: 'CLOSED' },
  })
  const out = s.run()
  assert.ok(!/design\/a-screen/.test(out), out)
  s.cleanup()
})

check('--dry-run reports the reap and deletes nothing', () => {
  const s = scenario({
    designs: { 'a-screen.md': { explorable: 'design/a-screen', epic: 700 } },
    issues: { 700: 'CLOSED' },
  })
  s.branch('design/a-screen')
  const out = s.run('--dry-run')
  assert.match(out, /reap design\/a-screen — epic #700 closed \(dry run\)/)
  assert.ok(s.remoteBranches().includes('design/a-screen'), out)
  s.cleanup()
})

check('a design whose path holds a space is still read', () => {
  // The loop over `ls-tree` output splits on newlines with globbing off. Under the default
  // IFS this name is two words, neither of which names a file, and the branch survives a
  // closed epic for no reason anybody could see.
  const s = scenario({
    designs: { 'a screen.md': { explorable: 'design/a-screen', epic: 700 } },
    issues: { 700: 'CLOSED' },
  })
  s.branch('design/a-screen')
  const out = s.run()
  assert.match(out, /reaped design\/a-screen/)
  assert.ok(!s.remoteBranches().includes('design/a-screen'), out)
  s.cleanup()
})

report('worktree-gc: the design-branch sweep')
