// The app-server's skill and config methods. Skills come from the JSON file ARGO_CODEX_SKILLS_FILE
// names, shaped like skills-list-codex-0.157.0.json's `skills`; a rewrite of it sends `skills/changed`.
// Like Codex, the list is cached until a request asks for `forceReload`.
import { readFileSync, watch } from 'node:fs'
import { createMockCodexUserConfig } from './mock-codex-user-config.ts'

export const MOCK_CODEX_SKILLS_FILE_ENV = 'ARGO_CODEX_SKILLS_FILE'
export const MOCK_CODEX_AUTO_COMPACT_LIMIT_ENV = 'ARGO_CODEX_AUTO_COMPACT_LIMIT'
const AUTO_COMPACT_KEY = 'model_auto_compact_token_limit'
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

export function createMockCodexSkillsAndConfig(send: Send): (message: Request) => boolean {
  const skillsFile = process.env[MOCK_CODEX_SKILLS_FILE_ENV]
  const seeded = process.env[MOCK_CODEX_AUTO_COMPACT_LIMIT_ENV]
  let limit: unknown = seeded === undefined ? null : Number(seeded)
  let cachedSkills: unknown
  const userConfig = createMockCodexUserConfig()
  if (skillsFile !== undefined)
    watch(skillsFile, () => send({ method: 'skills/changed', params: {} })).unref()
  // With layers, the user layer comes from the mock user config, as for the status hooks.
  function readConfig(params: Request['params']) {
    const config = { [AUTO_COMPACT_KEY]: limit }
    if (params?.includeLayers !== true) return { result: { config, origins: {}, layers: null } }
    const user = userConfig.layer()
    return 'error' in user ? user : { result: { config, origins: {}, layers: [user.result] } }
  }

  // The auto-compact limit is kept apart; any other replace goes to the user config.
  function writeConfig(params: Request['params']) {
    if (params?.mergeStrategy !== 'replace')
      return {
        error: { code: INVALID_REQUEST, message: `Mock does not write ${params?.keyPath}` },
      }
    if (params.keyPath !== AUTO_COMPACT_KEY) return userConfig.write(params)
    limit = params.value
    return {
      result: {
        status: 'ok',
        version: 'mock',
        filePath: '/mock/.codex/config.toml',
        overriddenMetadata: null,
      },
    }
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
        send({ id, ...readConfig(params) })
        return true
      case 'config/value/write':
        send({ id, ...writeConfig(params) })
        return true
      default:
        return false
    }
  }
}
