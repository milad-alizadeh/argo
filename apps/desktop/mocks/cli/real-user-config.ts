// Keeps the e2e runs off the person's own Harness config files, found from the account's home
// whatever HOME or the Harness folders are set to.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { CLAUDE_HOME_ENV } from '@/harnesses/claude/proof-protocol'
import { claudeSettingsFile } from '@/harnesses/claude/session/claude-status-hooks'
import { CODEX_HOME_ENV } from '@/harnesses/codex/proof-protocol'

const REAL_HOME = os.userInfo().homedir
const REAL_CONFIG_FILES = [
  claudeSettingsFile({}, REAL_HOME),
  path.join(REAL_HOME, '.codex', 'config.toml'),
]
// An Argo status hook command, in the socket form or the earlier port form.
const ARGO_HOOK = /curl [^"\n]*(?:127\.0\.0\.1:\d+|localhost)\/h\/(?:claude|codex)\b[^"\n]*/g

// Each config's Argo hook commands, in file order; a missing file holds none.
function argoHooks(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    try {
      return [...readFileSync(file, 'utf8').matchAll(ARGO_HOOK)].map(([hook]) => `${file}: ${hook}`)
    } catch {
      return []
    }
  })
}

// Records the configs' Argo status hooks and returns the step that throws when they changed:
// added, removed, rewritten or reordered, since a Harness may key hook trust by group position.
export function argoHooksUnchanged(files: readonly string[]): () => void {
  const before = argoHooks(files)
  return () => {
    const after = argoHooks(files)
    if (isDeepStrictEqual(after, before)) return
    const added = after.filter((hook) => !before.includes(hook))
    const removed = before.filter((hook) => !after.includes(hook))
    const order = added.length === 0 && removed.length === 0 ? ' Order changed.' : ''
    throw new Error(
      `Argo status hooks in the real config changed. Added: ${added.join(', ') || 'none'}. Removed: ${removed.join(', ') || 'none'}.${order}`,
    )
  }
}

// Playwright's global setup over the real configs, whose returned step is its teardown. Playwright
// passes its config, so the files are fixed here. Hooks already there are the person's own.
export default function realConfigArgoHooksUnchanged(): () => void {
  return argoHooksUnchanged(REAL_CONFIG_FILES)
}

// Every Harness home a registration reads from the environment.
export const HARNESS_HOME_ENVS = [CLAUDE_HOME_ENV, CODEX_HOME_ENV] as const
const THROWAWAY = path.join(os.tmpdir(), 'argo-harness-folders-')

// Points both Harness folders at throwaway ones, so a case cannot reach the person's own, even ones
// the shell names. A process that inherited throwaway folders keeps them, so a run's workers share
// the runner's. Returns the step that deletes a folder this made.
export function isolateHarnessFolders(): () => void {
  if (process.env[CODEX_HOME_ENV]?.startsWith(THROWAWAY)) return () => {}
  const base = mkdtempSync(THROWAWAY)
  for (const name of HARNESS_HOME_ENVS) {
    const folder = path.join(base, name.toLowerCase())
    mkdirSync(folder, { recursive: true })
    process.env[name] = folder
  }
  return () => rmSync(base, { recursive: true, force: true })
}
