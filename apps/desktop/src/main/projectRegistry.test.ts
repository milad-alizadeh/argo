import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  REGISTRY_FILENAME,
  readRegistry,
  registerProject,
  relocateProject,
  toProjectEvents,
} from './projectRegistry'

let userData: string

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'argo-registry-'))
})

afterEach(async () => {
  await rm(userData, { recursive: true, force: true })
})

const registryFile = (): string => join(userData, REGISTRY_FILENAME)

describe('registering a Project', () => {
  it('keeps a registered Project across a restart', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-plain-folder-'))
    await registerProject(registryFile(), folder)

    expect((await readRegistry(registryFile())).projects.map((p) => p.path)).toEqual([folder])
  })

  it('registers a plain folder that is not a git repository', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-no-git-'))
    const registry = await registerProject(registryFile(), folder)

    expect(registry.projects).toHaveLength(1)
  })

  it('makes the first registered Project the active one', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-first-'))
    const registry = await registerProject(registryFile(), folder)

    expect(registry.activeProjectId).toBe(registry.projects[0]?.id)
  })

  it('registers the same folder once however many times it is offered', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-twice-'))
    const first = await registerProject(registryFile(), folder)
    const second = await registerProject(registryFile(), `${folder}/`)

    expect(second.projects).toEqual(first.projects)
  })

  it('stores the registry as plain JSON a human can read', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-plain-json-'))
    await registerProject(registryFile(), folder)

    expect(JSON.parse(await readFile(registryFile(), 'utf8'))).toHaveProperty('projects')
  })
})

describe('relocating a Project', () => {
  it('keeps a Project id when its folder relocates', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-before-move-'))
    const moved = await mkdtemp(join(tmpdir(), 'argo-after-move-'))
    const before = await registerProject(registryFile(), folder)
    const id = before.projects[0]?.id ?? ''

    const after = await relocateProject(registryFile(), id, moved)

    expect(after.projects).toEqual([{ id, path: moved }])
  })

  it('re-points a relocated Project rather than registering a second one', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-relocate-'))
    const moved = await mkdtemp(join(tmpdir(), 'argo-relocated-'))
    const before = await registerProject(registryFile(), folder)
    await relocateProject(registryFile(), before.projects[0]?.id ?? '', moved)

    expect((await readRegistry(registryFile())).projects).toHaveLength(1)
  })

  it('ignores a relocation of a Project it does not know', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-unknown-'))
    const before = await registerProject(registryFile(), folder)

    expect(await relocateProject(registryFile(), 'not-a-project', '/tmp/nowhere')).toEqual(before)
  })
})

describe('reading a registry Argo did not write', () => {
  it('reads as empty on a machine that has never registered a Project', async () => {
    expect(await readRegistry(registryFile())).toEqual({ activeProjectId: null, projects: [] })
  })

  it('reads as empty rather than throwing when the file is unreadable', async () => {
    await writeFile(registryFile(), '{ this is not json', 'utf8')

    expect(await readRegistry(registryFile())).toEqual({ activeProjectId: null, projects: [] })
  })

  it('drops a stored entry that carries no folder path', async () => {
    await writeFile(
      registryFile(),
      JSON.stringify({ activeProjectId: null, projects: [{ id: 'half-written' }] }),
      'utf8',
    )

    expect((await readRegistry(registryFile())).projects).toEqual([])
  })

  it('forgets an active Project that is no longer registered', async () => {
    await writeFile(
      registryFile(),
      JSON.stringify({ activeProjectId: 'gone', projects: [] }),
      'utf8',
    )

    expect((await readRegistry(registryFile())).activeProjectId).toBeNull()
  })
})

describe('replaying the registry into the hub', () => {
  it('registers every known Project and activates the stored one', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'argo-events-'))
    const registry = await registerProject(registryFile(), folder)
    const id = registry.projects[0]?.id ?? ''

    expect(toProjectEvents(registry)).toEqual([
      { type: 'project-registered', project: { id, name: basename(folder), path: folder } },
      { type: 'project-activated', id },
    ])
  })

  it('activates nothing when no Project is active', () => {
    expect(toProjectEvents({ activeProjectId: null, projects: [] })).toEqual([])
  })
})
