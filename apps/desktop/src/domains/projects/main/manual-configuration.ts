import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { saveProjectConfiguration } from './project-configuration'
import { prepareSetupWorktree } from './setup-worktree'
import type { ProjectStore, SetupCheckpoint } from './sqlite-store'

type SetupProject = { id: string; path: string }
type CheckpointStore = Pick<ProjectStore, 'readSetupCheckpoint' | 'writeSetupCheckpoint'>

export async function saveManualProjectConfiguration(
  project: SetupProject,
  source: string,
  store: CheckpointStore,
): Promise<SetupCheckpoint> {
  const worktreePath =
    store.readSetupCheckpoint(project.id)?.worktreePath ?? (await prepareSetupWorktree(project))
  if (!(await saveProjectConfiguration(worktreePath, source)))
    throw new Error('Invalid configuration.')
  const file = path.join(worktreePath, '.gitignore')
  const current = await readFile(file, 'utf8').catch(() => '')
  const entries = ['.argo/settings.local.toml', '.argo/runtime/', '.argo/worktrees/']
  const missing = entries.filter((entry) => !current.split('\n').includes(entry))
  if (missing.length > 0) {
    const separator = current && !current.endsWith('\n') ? '\n' : ''
    await writeFile(file, `${current}${separator}${missing.join('\n')}\n`)
  }
  const checkpoint = {
    projectId: project.id,
    worktreePath,
    phase: 'editing' as const,
    configurationSource: source,
  }
  store.writeSetupCheckpoint(checkpoint)
  return checkpoint
}
