// The user config layer of a mock `codex app-server`, kept as JSON in `<CODEX_HOME>/mock-user-config.json`
// and in memory when CODEX_HOME is unset. It answers `config/read` layers and `config/value/write`
// the way codex 0.157 does: a dotted key path, `null` deletes the key, a stale `expectedVersion` is
// refused, and an unreadable file fails the read.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const MOCK_CODEX_USER_CONFIG_FILE = 'mock-user-config.json'
// The codes codex 0.157 answers a refused write and an unreadable config with.
const INVALID_REQUEST = -32600
const INTERNAL_ERROR = -32603
const MOCK_FILE = '/mock/.codex/config.toml'

type Config = Record<string, unknown>
type Failure = { code: number; message: string }

export function createMockCodexUserConfig() {
  const home = process.env.CODEX_HOME
  const file = home === undefined ? null : path.join(home, MOCK_CODEX_USER_CONFIG_FILE)
  let memory: Config = {}

  function read(): Config {
    if (file === null || !existsSync(file)) return memory
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  const versionOf = (config: Config) =>
    `sha256:${createHash('sha256').update(JSON.stringify(config)).digest('hex')}`

  function layer(): { result: unknown } | { error: Failure } {
    try {
      const config = read()
      const source = { type: 'user', file: file ?? MOCK_FILE, profile: null }
      return { result: { name: source, version: versionOf(config), config, disabledReason: null } }
    } catch (error) {
      return {
        error: { code: INTERNAL_ERROR, message: `failed to read configuration layers: ${error}` },
      }
    }
  }

  function write(params: Record<string, unknown>): { result: unknown } | { error: Failure } {
    if (params.filePath != null)
      return { error: { code: INVALID_REQUEST, message: 'The mock writes only the user config.' } }
    let config: Config
    try {
      config = read()
    } catch (error) {
      return { error: { code: INTERNAL_ERROR, message: String(error) } }
    }
    if (params.expectedVersion != null && params.expectedVersion !== versionOf(config))
      return {
        error: {
          code: INVALID_REQUEST,
          message: 'Configuration was modified since last read. Fetch latest version and retry.',
        },
      }
    const keys = String(params.keyPath).split('.')
    const last = keys.pop() as string
    let table = config
    for (const key of keys) {
      table[key] ??= {}
      table = table[key] as Config
    }
    if (params.value === null) delete table[last]
    else table[last] = params.value
    if (file === null) memory = config
    else {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(config, null, 2))
    }
    const version = versionOf(config)
    return {
      result: { status: 'ok', version, filePath: file ?? MOCK_FILE, overriddenMetadata: null },
    }
  }

  return { layer, write }
}
