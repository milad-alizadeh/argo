import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readSkillFile } from './read-skill-file'

async function tempDirectory(context: { after: (cleanup: () => unknown) => void }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-skill-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}

async function contentAt(requested: string) {
  const reply = await readSkillFile({
    version: 1,
    type: 'session.skill.read',
    requestId: 'r1',
    path: requested,
  })
  return reply.content
}

test('reads a mentioned skill, through a linked skill folder too', async (context) => {
  const directory = await tempDirectory(context)
  await mkdir(path.join(directory, 'implement'))
  await writeFile(path.join(directory, 'implement', 'SKILL.md'), '# Implement')
  await symlink(path.join(directory, 'implement'), path.join(directory, 'linked'))
  assert.equal(await contentAt(path.join(directory, 'implement', 'SKILL.md')), '# Implement')
  assert.equal(await contentAt(path.join(directory, 'linked', 'SKILL.md')), '# Implement')
})

test('reads nothing that is not a skill file', async (context) => {
  const directory = await tempDirectory(context)
  const secret = path.join(directory, 'secret.txt')
  await writeFile(secret, 'secret')
  await symlink(secret, path.join(directory, 'SKILL.md'))
  for (const requested of [
    secret,
    path.join(directory, 'SKILL.md'),
    'implement/SKILL.md',
    path.join(directory, 'missing', 'SKILL.md'),
  ]) {
    assert.equal(await contentAt(requested), null, requested)
  }
})
