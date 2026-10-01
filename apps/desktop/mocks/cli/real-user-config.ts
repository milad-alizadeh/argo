// The person's own Harness config files, found from the account's home whatever HOME or the
// Harness folders are set to. A test records them first and fails if a hook install touched one.
import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const REAL_HOME = os.userInfo().homedir
const REAL_CONFIG_FILES = [
  path.join(REAL_HOME, '.claude', 'settings.json'),
  path.join(REAL_HOME, '.codex', 'config.toml'),
]

function stamp(file: string) {
  try {
    const { size, mtimeMs, ino } = statSync(file)
    return { size, mtimeMs, ino }
  } catch {
    return null
  }
}

// Returns the check that the files are as they were when this was called.
export function guardRealUserConfig(): () => void {
  const before = REAL_CONFIG_FILES.map(stamp)
  return () => assert.deepEqual(REAL_CONFIG_FILES.map(stamp), before, 'A real config file changed.')
}

// Points both Harness folders at `root`, and returns the step that restores them. HOME is not
// one of them: Bun reads it once at start, so only a child process can move the home folder.
export function isolateHarnessFolders(root: string): () => void {
  const names = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME'] as const
  const saved = names.map((name) => [name, process.env[name]] as const)
  process.env.CLAUDE_CONFIG_DIR = path.join(root, 'claude-config')
  process.env.CODEX_HOME = path.join(root, 'codex-home')
  return () => {
    for (const [name, value] of saved)
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
  }
}
