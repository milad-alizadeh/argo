import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { CLAUDE_HISTORY_HOME_ENV } from '@/harnesses/claude/proof-protocol'
import { CODEX_HISTORY_HOME_ENV } from '@/harnesses/codex/proof-protocol'

// Every vendor history root a Harness registration reads. Add a Harness's variable here.
export const HARNESS_HISTORY_HOME_ENVS = [CLAUDE_HISTORY_HOME_ENV, CODEX_HISTORY_HOME_ENV]

// The environment an e2e launch of the app starts from: the host's own, with each Harness's home
// replaced by an empty temp folder, so the app never scans the machine's real Sessions. A case
// that needs vendor history writes it into that folder, or names its own home after this spread.
export async function isolatedLaunchEnvironment(root: string): Promise<Record<string, string>> {
  const homes = await Promise.all(
    HARNESS_HISTORY_HOME_ENVS.map(async (name) => {
      const home = path.join(root, 'harness-home', name)
      await mkdir(home, { recursive: true })
      return [name, home] as const
    }),
  )
  const host = Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  )
  return { ...Object.fromEntries(host), ...Object.fromEntries(homes) }
}
