import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readGitFacts } from './gitFacts'
import { runGitOperation } from './operations'
import { runGit } from './runGit'

// Every operation runs against a real repository built here: what is under test is whether git
// accepts the argv and whether the refusals are git's own, which only git can answer.
describe('the manage menu', () => {
  let folder = ''
  const request = (operation: 'new-branch' | 'rename' | 'delete' | 'checkout', ref?: string) =>
    runGitOperation(folder, { projectId: 'irrelevant', operation, ...(ref ? { ref } : {}) })

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'argo-git-ops-'))
    await runGit(folder, ['init', '--initial-branch=main'])
    await runGit(folder, ['config', 'user.email', 'cockpit@argo.dev'])
    await runGit(folder, ['config', 'user.name', 'Argo'])
    await writeFile(join(folder, 'README.md'), 'one\n', 'utf8')
    await runGit(folder, ['add', 'README.md'])
    await runGit(folder, ['commit', '--message', 'one'])
  })

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true })
  })

  it('creates a new branch and checks it out', async () => {
    await expect(request('new-branch', 'topic')).resolves.toMatchObject({ ok: true })
    await expect(readGitFacts(folder)).resolves.toMatchObject({ branch: 'topic' })
  })

  it('renames the checked-out branch', async () => {
    await expect(request('rename', 'renamed')).resolves.toMatchObject({ ok: true })
    await expect(readGitFacts(folder)).resolves.toMatchObject({ branch: 'renamed' })
  })

  it('checks out an existing branch', async () => {
    await request('new-branch', 'topic')
    await expect(request('checkout', 'main')).resolves.toMatchObject({ ok: true })
    await expect(readGitFacts(folder)).resolves.toMatchObject({ branch: 'main' })
  })

  it('deletes a branch that is fully merged', async () => {
    await request('new-branch', 'topic')
    await request('checkout', 'main')
    await expect(request('delete', 'topic')).resolves.toMatchObject({ ok: true })
  })

  it('refuses to delete a branch holding unmerged commits, in git own words', async () => {
    await request('new-branch', 'topic')
    await writeFile(join(folder, 'README.md'), 'two\n', 'utf8')
    await runGit(folder, ['commit', '--all', '--message', 'two'])
    await request('checkout', 'main')

    const refused = await request('delete', 'topic')
    expect(refused.ok).toBe(false)
    expect(refused.detail).toContain('not fully merged')
  })

  it('refuses an operation that names no branch', async () => {
    await expect(request('checkout')).resolves.toEqual({
      ok: false,
      detail: 'checkout names no branch',
    })
  })
})
