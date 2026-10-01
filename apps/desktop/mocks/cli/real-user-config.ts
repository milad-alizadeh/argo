// Keeps the e2e runs off the person's own Harness config files, found from the account's home
// whatever HOME or the Harness folders are set to.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { claudeSettingsFile } from '@/harnesses/claude/session/claude-status-hooks'

const REAL_HOME = os.userInfo().homedir
const REAL_CONFIG_FILES = [
  claudeSettingsFile({}, REAL_HOME),
  path.join(REAL_HOME, '.codex', 'config.toml'),
]
// An Argo status hook URL, in the socket form or the earlier port form.
const ARGO_HOOK = /(?:127\.0\.0\.1:\d+|localhost)\/h\/(?:claude|codex)\b/

// Playwright's global teardown: the run fails while a real config holds any Argo status hook, so a
// leak stays red until it is removed by hand.
export default function noArgoHooksInRealConfig(): void {
  const leaked = REAL_CONFIG_FILES.filter((file) => {
    try {
      return ARGO_HOOK.test(readFileSync(file, 'utf8'))
    } catch {
      return false
    }
  })
  if (leaked.length > 0) throw new Error(`Argo status hooks leaked into ${leaked.join(' and ')}.`)
}

const HARNESS_FOLDERS = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME'] as const
const THROWAWAY = path.join(os.tmpdir(), 'argo-harness-folders-')

// Points both Harness folders at throwaway ones, so a case cannot reach the person's own, even ones
// the shell names. A process that inherited throwaway folders keeps them, so a run's workers share
// the runner's. Returns the step that deletes a folder this made.
export function isolateHarnessFolders(): () => void {
  if (process.env.CODEX_HOME?.startsWith(THROWAWAY)) return () => {}
  const base = mkdtempSync(THROWAWAY)
  for (const name of HARNESS_FOLDERS) {
    const folder = path.join(base, name.toLowerCase())
    mkdirSync(folder, { recursive: true })
    process.env[name] = folder
  }
  return () => rmSync(base, { recursive: true, force: true })
}
