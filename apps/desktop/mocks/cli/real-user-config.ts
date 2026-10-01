// The person's own Harness config files, found from the account's home whatever HOME or the
// Harness folders are set to. A test records them first and fails if a hook install touched one.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeSettingsFile } from '@/harnesses/claude/session/claude-status-hooks'

const REAL_HOME = os.userInfo().homedir
const REAL_CONFIG_FILES = [
  claudeSettingsFile({}, REAL_HOME),
  path.join(REAL_HOME, '.codex', 'config.toml'),
]

// The Argo hook commands in a file. The person's own apps rewrite these files at any time, so only
// a change to Argo's entries counts.
function argoHooks(file: string): string[] {
  try {
    return readFileSync(file, 'utf8').match(/127\.0\.0\.1:\d+\/h\/\w+\/\w+/g) ?? []
  } catch {
    return []
  }
}

// Returns the check that no Argo hook in the files changed since this was called.
export function guardRealUserConfig(): () => void {
  const before = REAL_CONFIG_FILES.map(argoHooks)
  return () =>
    assert.deepEqual(REAL_CONFIG_FILES.map(argoHooks), before, 'A real config file changed.')
}

// Points both Harness folders at throwaway ones for a whole test run, so a test that names none
// cannot reach the person's own, even one the shell names; a run's workers keep the runner's.
// Returns the step that deletes them.
export function isolateHarnessFoldersForRun(run: string): () => void {
  const folders = (['CLAUDE_CONFIG_DIR', 'CODEX_HOME'] as const).flatMap((name) => {
    const prefix = path.join(os.tmpdir(), `argo-${run}-${name.toLowerCase()}-`)
    if (process.env[name]?.startsWith(prefix)) return []
    const folder = mkdtempSync(prefix)
    process.env[name] = folder
    return [folder]
  })
  return () => {
    for (const folder of folders) rmSync(folder, { recursive: true, force: true })
  }
}
