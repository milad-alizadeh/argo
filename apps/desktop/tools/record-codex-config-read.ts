// Re-records the real codex app-server `config/read` with layers that the Codex status hook tests
// answer from, in a throwaway CODEX_HOME seeded with a user config that holds hooks of its own.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCodexAppServerClient } from '@/harnesses/codex/app-server/codex-app-server-client'

const USER_CONFIG = `model = "gpt-5.5"

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "say done"

[[hooks.PreToolUse]]
matcher = "^Bash$"
[[hooks.PreToolUse.hooks]]
type = "command"
command = "./check.sh"
`

const version = execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim().split(' ').at(-1)
const home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'argo-record-codex-home-')))
process.env.CODEX_HOME = home
writeFileSync(path.join(home, 'config.toml'), USER_CONFIG)
const client = createCodexAppServerClient({
  resolveExecutable: async () => ({ executable: 'codex', version: `codex ${version}` }),
})
try {
  const read = await client.request('config/read', { includeLayers: true }, (value) => value)
  const text = JSON.stringify(read, null, 2).replaceAll(home, '/Users/person/.codex')
  const output = `mocks/cli/codex/fixtures/config-read-codex-${version}.json`
  writeFileSync(output, `${text}\n`)
  process.stdout.write(`Recorded ${output}\n`)
} finally {
  client.shutdown()
  rmSync(home, { recursive: true, force: true })
}
