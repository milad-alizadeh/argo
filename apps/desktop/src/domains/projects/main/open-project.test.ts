import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { openProject } from './open-project'
import type { ProjectStore } from './register-project'

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'argo-open-project-'))
  context.after(() => rm(project, { recursive: true, force: true }))
  const store: Pick<ProjectStore, 'projects'> = {
    projects: {
      read: () => ({
        projects: [{ id: 'project-1', path: project, commonDirectory: path.join(project, '.git') }],
        selectedId: 'project-1',
      }),
      replace: () => undefined,
      updateProjectPath: () => undefined,
      readSetupCheckpoint: () => null,
      writeSetupCheckpoint: () => undefined,
      close: () => undefined,
    },
  }
  return { project, name: path.basename(project), store: store as ProjectStore }
}

test('routes an unconfigured Project to required setup', async (context) => {
  const { name, store } = await fixture(context)

  assert.deepEqual(
    await openProject(
      { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' },
      store,
    ),
    {
      version: 1,
      type: 'project.setup-required',
      requestId: 'open-1',
      project: { id: 'project-1', name },
    },
  )
})

test('opens a Project after its shared configuration is valid', async (context) => {
  const { project, store } = await fixture(context)
  await mkdir(path.join(project, '.argo'))
  await writeFile(
    path.join(project, '.argo', 'settings.toml'),
    [
      'version = 1',
      '',
      '[targets.app]',
      'default = true',
      'path = "."',
      'setup = "bun install"',
      'run = "bun run dev"',
      'build = "bun run build"',
      'test = "bun test"',
      '',
    ].join('\n'),
  )

  assert.equal(
    (
      await openProject(
        { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' },
        store,
      )
    ).type,
    'project.opened',
  )
})
