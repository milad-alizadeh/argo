// The person's own Harness config files, found from the account's home whatever HOME or the
// Harness folders are set to. A test records them first and fails if a hook install touched one.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeSettingsFile } from '@/harnesses/claude/session/claude-status-hooks'
import { argoHookUrls } from './status-hooks'

const REAL_HOME = os.userInfo().homedir
const REAL_CONFIG_FILES = [
  claudeSettingsFile({}, REAL_HOME),
  path.join(REAL_HOME, '.codex', 'config.toml'),
]

// The Argo hook commands in a file. The person's own apps rewrite these files at any time, so only
// a change to Argo's entries counts.
function argoHooks(file: string): string[] {
  try {
    return argoHookUrls(readFileSync(file, 'utf8')).map(([url]) => url)
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

const HARNESS_FOLDERS = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME'] as const
const THROWAWAY = path.join(os.tmpdir(), 'argo-harness-folders-')

// Points both Harness folders at throwaway ones under `root`, or under a new temp folder, so a test
// cannot reach the person's own, even ones the shell names. With no root, a process that inherited
// throwaway folders keeps them, so a run's workers share the runner's. Returns the step that
// restores the variables and deletes a folder this made.
export function isolateHarnessFolders(root?: string): () => void {
  if (root === undefined && process.env.CODEX_HOME?.startsWith(THROWAWAY)) return () => {}
  const base = root ?? mkdtempSync(THROWAWAY)
  const before = HARNESS_FOLDERS.map((name) => [name, process.env[name]] as const)
  for (const name of HARNESS_FOLDERS) {
    const folder = path.join(base, name.toLowerCase())
    mkdirSync(folder, { recursive: true })
    process.env[name] = folder
  }
  return () => {
    for (const [name, value] of before)
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    if (root === undefined) rmSync(base, { recursive: true, force: true })
  }
}
