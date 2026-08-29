#!/usr/bin/env node
// Test for the owned-skill guard, run via `bun run test:hooks`.
// Reproduces the real failure it exists for: a field-test install of the bundle into a
// consumer repo replaced that repo's tracked `.claude/skills/ship/SKILL.md` with a symlink
// into the vendored payload, and `git status` reported it as a plain deletion.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  describeRestore,
  restoreOwnedSkills,
  snapshotOwnedSkills,
} from '../packages/argo-skills/bin/protect-owned-skills.mjs'
import { check, report } from './check-harness.mjs'

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

const OWNED = '.claude/skills/ship/SKILL.md'
const BODY = '# Ship\n\nThis repo owns this skill.\n'

// A repo with one tracked skill of its own and a gitignored vendored payload, mirroring
// what a consumer looks like the moment before `skills add` runs.
function makeRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-owned-skills-'))
  git(root, 'init', '-q')
  git(root, 'config', 'user.email', 't@t')
  git(root, 'config', 'user.name', 't')
  mkdirSync(path.join(root, '.claude/skills/ship'), { recursive: true })
  writeFileSync(path.join(root, OWNED), BODY)
  mkdirSync(path.join(root, '.agents/skills/ship'), { recursive: true })
  writeFileSync(path.join(root, '.agents/skills/ship/SKILL.md'), '# Bundle ship\n')
  writeFileSync(path.join(root, '.gitignore'), '.agents/\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'initial')
  return root
}

// What `skills add` does: drop the directory, symlink the name at the vendored copy.
function clobber(root) {
  rmSync(path.join(root, '.claude/skills/ship'), { recursive: true, force: true })
  symlinkSync('../../.agents/skills/ship', path.join(root, '.claude/skills/ship'))
}

const repo = makeRepo()

check('snapshot claims tracked skills and ignores the vendored payload', () => {
  const snapshot = snapshotOwnedSkills(repo)
  assert.deepEqual(snapshot, [OWNED])
})

check("a clobbered skill is restored with its own content, not the bundle's", () => {
  const snapshot = snapshotOwnedSkills(repo)
  clobber(repo)
  assert.equal(
    readFileSync(path.join(repo, OWNED), 'utf8'),
    '# Bundle ship\n',
    'setup: symlink resolves to the payload',
  )

  const restored = restoreOwnedSkills(repo, snapshot)

  assert.deepEqual(restored, [OWNED])
  assert.equal(readFileSync(path.join(repo, OWNED), 'utf8'), BODY)
  assert.equal(lstatSync(path.join(repo, '.claude/skills/ship')).isSymbolicLink(), false)
  assert.equal(git(repo, 'status', '--porcelain').trim(), '', 'repo is clean again')
})

check('an untouched repo restores nothing', () => {
  const untouched = makeRepo()
  assert.deepEqual(restoreOwnedSkills(untouched, snapshotOwnedSkills(untouched)), [])
  rmSync(untouched, { recursive: true, force: true })
})

check('a non-git target is left alone rather than guessed at', () => {
  const plain = mkdtempSync(path.join(tmpdir(), 'argo-owned-skills-plain-'))
  mkdirSync(path.join(plain, '.claude/skills/ship'), { recursive: true })
  writeFileSync(path.join(plain, OWNED), BODY)
  assert.deepEqual(snapshotOwnedSkills(plain), [])
  rmSync(plain, { recursive: true, force: true })
})

check('the warning names every restored file', () => {
  const message = describeRestore([OWNED, '.claude/skills/qa/SKILL.md'])
  assert.match(message, /2 skill file\(s\)/)
  assert.match(message, /\.claude\/skills\/qa\/SKILL\.md/)
})

rmSync(repo, { recursive: true, force: true })
assert.equal(existsSync(repo), false)

report('owned-skill guard')
