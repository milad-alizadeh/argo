// The app-server's skill and config methods. Skills come from the JSON file ARGO_CODEX_SKILLS_FILE
// names, shaped like skills-list-codex-0.157.0.json's `skills`; a rewrite of it sends `skills/changed`.
// Like Codex, the list is cached until a request asks for `forceReload`.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs'
import path from 'node:path'
import { recordedCall } from '../recorded-codex-threads.ts'

export const MOCK_CODEX_SKILLS_FILE_ENV = 'ARGO_CODEX_SKILLS_FILE'
export const MOCK_CODEX_AUTO_COMPACT_LIMIT_ENV = 'ARGO_CODEX_AUTO_COMPACT_LIMIT'
const AUTO_COMPACT_KEY = 'model_auto_compact_token_limit'
// The status hooks a `hooks.<Event>` write stored, which the recorded user layer then reads back.
export const MOCK_CODEX_USER_HOOKS_FILE = 'mock-user-hooks.json'
// The code codex 0.157 answers a config write it refuses with.
const INVALID_REQUEST = -32600

type Send = (message: Record<string, unknown>) => void
type Request = { id?: unknown; method?: string; params?: Record<string, unknown> }

function listedSkills(file: string | undefined): unknown {
  return file === undefined ? [] : JSON.parse(readFileSync(file, 'utf8'))
}

function requestedCwd(params: Record<string, unknown> | undefined): string {
  const cwds = params?.cwds
  return Array.isArray(cwds) && typeof cwds[0] === 'string' ? cwds[0] : process.cwd()
}

// The user layer's hooks table, kept in `file`.
function userHooks(file: string) {
  const hooks = (): Record<string, unknown> =>
    existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  return {
    hooks,
    // Like codex, the version is a hash of what the layer holds.
    version: () => `sha256:${createHash('sha256').update(JSON.stringify(hooks())).digest('hex')}`,
    // Like codex 0.157, a null value deletes the event.
    writeHook(event: string, value: unknown) {
      const { [event]: _old, ...rest } = hooks()
      writeFileSync(file, JSON.stringify(value === null ? rest : { ...rest, [event]: value }))
    },
  }
}

export function createMockCodexSkillsAndConfig(
  send: Send,
  codexHome = process.env.CODEX_HOME ?? '',
): (message: Request) => boolean {
  const skillsFile = process.env[MOCK_CODEX_SKILLS_FILE_ENV]
  const seeded = process.env[MOCK_CODEX_AUTO_COMPACT_LIMIT_ENV]
  let limit: unknown = seeded === undefined ? null : Number(seeded)
  let cachedSkills: unknown
  const { hooks, version, writeHook } = userHooks(path.join(codexHome, MOCK_CODEX_USER_HOOKS_FILE))
  if (skillsFile !== undefined)
    watch(skillsFile, () => send({ method: 'skills/changed', params: {} })).unref()

  function readConfig(params: Request['params']) {
    const config = { [AUTO_COMPACT_KEY]: limit }
    const layers = recordedCall('config/read').result.layers.map((layer) =>
      layer.name.type === 'user'
        ? { ...layer, version: version(), config: { hooks: hooks() } }
        : layer,
    )
    return { config, origins: {}, layers: params?.includeLayers === true ? layers : null }
  }

  // The auto-compact limit and the status hooks are the only keys the mock writes.
  function writeConfig(params: Request['params']) {
    const keyPath = String(params?.keyPath)
    const event = keyPath.startsWith('hooks.') ? keyPath.slice('hooks.'.length) : null
    if (params?.mergeStrategy !== 'replace' || (keyPath !== AUTO_COMPACT_KEY && event === null))
      return { error: { code: INVALID_REQUEST, message: `Mock does not write ${keyPath}` } }
    if (event !== null) writeHook(event, params.value)
    else limit = params.value
    const result = { status: 'ok', version: version(), filePath: '/mock/.codex/config.toml' }
    return { result: { ...result, overriddenMetadata: null } }
  }

  return (message) => {
    const { id, params } = message
    switch (message.method) {
      case 'skills/list':
        if (cachedSkills === undefined || params?.forceReload === true)
          cachedSkills = listedSkills(skillsFile)
        send({
          id,
          result: {
            data: [{ cwd: requestedCwd(params), skills: cachedSkills, errors: [] }],
          },
        })
        return true
      case 'config/read':
        send({ id, result: readConfig(params) })
        return true
      case 'config/value/write':
        send({ id, ...writeConfig(params) })
        return true
      default:
        return false
    }
  }
}
