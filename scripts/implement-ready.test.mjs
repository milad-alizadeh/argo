#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_PATH = 'packages/argo-skills/skills/implement/SKILL.md'

check('the bundled implement skill reports Ready after review and commit', () => {
  const skill = readFileSync(path.join(ROOT, SKILL_PATH), 'utf8')
  const review = skill.indexOf('code-review')
  const commit = skill.indexOf('Commit your work')
  const ready = skill.indexOf('mcp__argo__report_ready')

  assert.ok(review >= 0, 'the implement skill does not name code-review')
  assert.ok(commit > review, 'the commit must follow the review')
  assert.ok(ready > commit, 'report_ready must follow the review and commit')
})

check("the bundle installs Argo's implement skill", () => {
  const lock = JSON.parse(readFileSync(path.join(ROOT, 'skills-lock.json'), 'utf8'))
  assert.equal(lock.skills.implement.source, 'milad-alizadeh/argo')
  assert.equal(lock.skills.implement.skillPath, SKILL_PATH)
})

report('implement ready')
