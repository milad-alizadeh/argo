import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { registerProject } from '@/domains/projects/main/register-project'
import { fixture, register, repository } from '../../../../mocks/projects/mock-registration'

const run = promisify(execFile)

test('linked worktrees share a Project while an independent clone remains separate', async (context) => {
  const setup = await fixture(context)
  const primary = await repository(setup.root, 'primary')
  await writeFile(path.join(primary, 'README.md'), 'Project identity fixture\n')
  await run('git', ['-C', primary, 'add', 'README.md'])
  await run('git', [
    '-C',
    primary,
    '-c',
    'user.email=argo@example.test',
    '-c',
    'user.name=Argo',
    'commit',
    '-m',
    'fixture',
  ])
  const linked = path.join(setup.root, 'linked')
  await run('git', ['-C', primary, 'worktree', 'add', '-b', 'linked-fixture', linked])
  setup.choose(primary)
  const first = await registerProject(register('r1'), setup.store)
  setup.choose(linked)
  const fromLinkedWorktree = await registerProject(register('r2'), setup.store)
  const independentClone = path.join(setup.root, 'independent')
  await run('git', ['clone', '--quiet', primary, independentClone])
  setup.choose(independentClone)
  const independent = await registerProject(register('r3'), setup.store)
  assert.equal(fromLinkedWorktree.selectedId, first.selectedId)
  assert.notEqual(independent.selectedId, first.selectedId)
  assert.equal(independent.projects.length, 2)
})
