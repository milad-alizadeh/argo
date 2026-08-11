#!/usr/bin/env node
// Test for skill retirement, run via `bun run test:hooks`.
// Reproduces the real failure it exists for: renaming `componentize-design` to
// `design-to-code` in the lock left the old skill installed and still model-invocable, so two
// skills advertised themselves for the same prompts and the retired one sometimes won.
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  contradictoryNames,
  describeRetired,
  retireSkills,
} from '../packages/argo-skills/bin/retire-skills.mjs'

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

const RETIRED = ['componentize-design', 'visual-verify']

// An install as `skills add` leaves it: a real payload under `.agents/skills` and a symlink
// into it from `.claude/skills`, plus one skill installed out of band that no lock names.
function makeInstall() {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-retire-'))
  for (const name of [...RETIRED, 'graphify']) {
    const payload = path.join(root, '.agents/skills', name)
    mkdirSync(payload, { recursive: true })
    writeFileSync(path.join(payload, 'SKILL.md'), `# ${name}\n`)
  }
  mkdirSync(path.join(root, '.claude/skills'), { recursive: true })
  for (const name of RETIRED) {
    symlinkSync(path.join(root, '.agents/skills', name), path.join(root, '.claude/skills', name))
  }
  return root
}

const installed = (root, dir, name) => existsSync(path.join(root, dir, name))

check('a dry run reports every copy and removes none', () => {
  const root = makeInstall()
  const { removed } = retireSkills(root, RETIRED, { dryRun: true })
  assert.equal(removed.length, 4, `expected 4 paths, got ${removed.length}`)
  assert.ok(installed(root, '.agents/skills', 'componentize-design'), 'payload was removed')
  assert.ok(installed(root, '.claude/skills', 'componentize-design'), 'symlink was removed')
})

check('the real run removes the payload and the symlink into it', () => {
  const root = makeInstall()
  retireSkills(root, RETIRED)
  for (const name of RETIRED) {
    assert.ok(!installed(root, '.agents/skills', name), `${name} payload survived`)
    assert.ok(!installed(root, '.claude/skills', name), `${name} symlink survived`)
  }
})

// The reason retirement is an explicit list: absence from `skills` cannot tell a retired skill
// from one installed out of band, and nothing under a skills directory is git-tracked here.
check('a skill no lock names is left alone', () => {
  const root = makeInstall()
  retireSkills(root, RETIRED)
  assert.ok(installed(root, '.agents/skills', 'graphify'), 'out-of-band skill was deleted')
})

check('a second run is a no-op', () => {
  const root = makeInstall()
  retireSkills(root, RETIRED)
  assert.deepEqual(retireSkills(root, RETIRED).removed, [], 'second run reported removals')
})

// A dangling link still shadows the name in the agent's skill list, so it has to go too.
check('a symlink whose payload is already gone is still removed', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-retire-dangling-'))
  mkdirSync(path.join(root, '.claude/skills'), { recursive: true })
  symlinkSync(path.join(root, 'nowhere'), path.join(root, '.claude/skills/visual-verify'))
  const { removed } = retireSkills(root, ['visual-verify'])
  assert.deepEqual(removed, ['.claude/skills/visual-verify'])
})

check('a name listed as both installed and retired is reported', () => {
  const manifest = { skills: { ship: {}, 'design-to-code': {} }, retired: ['ship'] }
  assert.deepEqual(contradictoryNames(manifest), ['ship'])
  assert.deepEqual(contradictoryNames({ skills: { ship: {} } }), [], 'no retired array')
})

check('nothing retired and nothing installed says nothing', () => {
  const none = { removed: [], kept: [] }
  assert.equal(describeRetired(none, 0, false), '')
  assert.match(describeRetired(none, 3, false), /none installed/)
  assert.match(describeRetired({ removed: ['.agents/skills/x'], kept: [] }, 1, true), /dry run/)
})

// A retired name is ordinary English — `qa` is one a team picks for itself. Deleting the
// consumer's own skill because the bundle dropped a skill of that name is unrecoverable when
// it is untracked, so tracked-in-git is the ownership test and a collision is reported.
check('a retired name the repo tracks is kept and reported', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-retire-owned-'))
  // The repo's own skill is a real directory it wrote, not a symlink `skills add` published.
  mkdirSync(path.join(root, '.claude/skills/qa'), { recursive: true })
  writeFileSync(path.join(root, '.claude/skills/qa/SKILL.md'), 'ours\n')
  mkdirSync(path.join(root, '.agents/skills/qa'), { recursive: true })
  writeFileSync(path.join(root, '.agents/skills/qa/SKILL.md'), "the bundle's\n")

  const { removed, kept } = retireSkills(root, ['qa'], { owned: ['.claude/skills/qa/SKILL.md'] })
  assert.deepEqual(kept, ['.claude/skills/qa'])
  assert.ok(installed(root, '.claude/skills', 'qa'), "the repo's own skill was deleted")
  assert.deepEqual(removed, ['.agents/skills/qa'], 'the vendored payload was not removed')
  assert.match(describeRetired({ removed, kept }, 1, false), /tracked in git/)
})

console.log(failures ? `\nretire-skills: ${failures} check(s) failed` : '\nretire-skills: ok')
process.exit(failures ? 1 : 0)
