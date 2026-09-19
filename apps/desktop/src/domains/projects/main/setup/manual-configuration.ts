import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readProjectConfigurationSource, saveProjectConfiguration } from '@/domains/projects/main/project-configuration'
import type { ProjectStore, SetupCheckpoint } from '@/domains/projects/main/sqlite-store'
import { prepareSetupWorktree } from './setup-worktree'

type SetupProject = { id: string; path: string }
type CheckpointStore = Pick<ProjectStore, 'readSetupCheckpoint' | 'writeSetupCheckpoint'>

export async function saveManualProjectConfiguration(request: {
  project: SetupProject
  source: string
  store: CheckpointStore
  documentRevision: string
}): Promise<SetupCheckpoint> {
  const { documentRevision, project, source, store } = request
  const previous = store.readSetupCheckpoint(project.id)
  const worktreePath = previous?.worktreePath ?? (await prepareSetupWorktree(project))
  if (!(await saveProjectConfiguration(worktreePath, source)))
    throw new Error('Invalid configuration.')
  const file = path.join(worktreePath, '.gitignore')
  const current = await readFile(file, 'utf8').catch(() => '')
  const entries = ['.argo/settings.local.json', '.argo/runtime/', '.argo/worktrees/']
  const missing = entries.filter((entry) => !current.split('\n').includes(entry))
  if (missing.length > 0) {
    const separator = current && !current.endsWith('\n') ? '\n' : ''
    await writeFile(file, `${current}${separator}${missing.join('\n')}\n`)
  }
  const phase: SetupCheckpoint['phase'] =
    previous?.phase === 'ready' && previous.configurationSource === source ? 'ready' : 'editing'
  const configurationSource =
    phase === 'ready' ? ((await readProjectConfigurationSource(worktreePath)) ?? source) : source
  const checkpoint = {
    projectId: project.id,
    worktreePath,
    phase,
    configurationSource,
    documentRevision,
  }
  store.writeSetupCheckpoint(checkpoint)
  return checkpoint
}
