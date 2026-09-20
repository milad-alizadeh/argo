import { readFile, writeFile } from 'node:fs/promises'

// `claude` shows an interactive trust dialog the first time it launches in a directory, and a
// disposable setup worktree is always new. No human watches this launch to click through it, so
// mark the directory trusted the same way accepting that dialog would.
export async function trustSetupWorktree(configPath: string, directory: string): Promise<void> {
  const raw = await readFile(configPath, 'utf8').catch(() => '{}')
  const config: { projects?: Record<string, { hasTrustDialogAccepted?: boolean }> } = JSON.parse(raw)
  config.projects ??= {}
  if (config.projects[directory]?.hasTrustDialogAccepted) return
  config.projects[directory] = { ...config.projects[directory], hasTrustDialogAccepted: true }
  await writeFile(configPath, JSON.stringify(config, null, 2))
}
