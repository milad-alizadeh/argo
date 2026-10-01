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
// An Argo status hook command, in the socket form or the earlier port form.
const ARGO_HOOK = /curl [^"\n]*(?:127\.0\.0\.1:\d+|localhost)\/h\/(?:claude|codex)\b[^"\n]*/g

function argoHooks(): Set<string> {
  return new Set(
    REAL_CONFIG_FILES.flatMap((file) => {
      try {
        return [...readFileSync(file, 'utf8').matchAll(ARGO_HOOK)].map(
          ([hook]) => `${file}: ${hook}`,
        )
      } catch {
        return []
      }
    }),
  )
}

// Playwright's global setup, whose returned step is its teardown: the run fails when a real config
// holds an Argo status hook it did not hold before, so a leak from a case stays red. A hook the
// installed app or a dev run wrote is the person's own.
export default function noArgoHooksAddedToRealConfig(): () => void {
  const before = argoHooks()
  return () => {
    const added = [...argoHooks()].filter((hook) => !before.has(hook))
    if (added.length > 0) throw new Error(`Argo status hooks leaked into ${added.join(' and ')}.`)
  }
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
