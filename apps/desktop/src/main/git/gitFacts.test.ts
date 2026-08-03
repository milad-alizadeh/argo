import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readGitFacts } from './gitFacts'

// Runs the real git binary against a real folder: the answer being tested is git's, and a fake
// would only prove that this module agrees with itself.
describe('a project folder that is not a git repository', () => {
  let folder = ''

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'argo-no-repo-'))
  })

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true })
  })

  it('has no git facts at all, so the shell can hide the whole git group', async () => {
    await expect(readGitFacts(folder)).resolves.toBeNull()
  })
})
