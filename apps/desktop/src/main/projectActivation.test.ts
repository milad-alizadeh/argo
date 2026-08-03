import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  REGISTRY_FILENAME,
  readRegistry,
  registerProject,
  setActiveProject,
} from './projectRegistry'

let userData = ''

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'argo-activation-'))
})

afterEach(async () => {
  await rm(userData, { recursive: true, force: true })
})

const registryFile = (): string => join(userData, REGISTRY_FILENAME)

const twoProjects = async (): Promise<string[]> => {
  const first = await mkdtemp(join(tmpdir(), 'argo-project-one-'))
  const second = await mkdtemp(join(tmpdir(), 'argo-project-two-'))
  await registerProject(registryFile(), first)
  const registry = await registerProject(registryFile(), second)
  return registry.projects.map((project) => project.id)
}

describe('switching the active Project', () => {
  it('opens into the Project the user last switched to after a restart', async () => {
    const [, second = ''] = await twoProjects()
    await setActiveProject(registryFile(), second)

    expect((await readRegistry(registryFile())).activeProjectId).toBe(second)
  })

  it('ignores a switch to a Project it does not know', async () => {
    const [first = ''] = await twoProjects()

    expect(await setActiveProject(registryFile(), 'not-a-project')).toMatchObject({
      activeProjectId: first,
    })
  })
})
