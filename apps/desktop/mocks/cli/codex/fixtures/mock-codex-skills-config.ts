// The app-server's skill and config methods. Skills come from the JSON file ARGO_CODEX_SKILLS_FILE
// names, shaped like skills-list-codex-0.157.0.json's `skills`; a rewrite of it sends `skills/changed`.
// Like Codex, the list is cached until a request asks for `forceReload`.
import { readFileSync, watch } from 'node:fs'

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
  if (skillsFile !== undefined)
    watch(skillsFile, () => send({ method: 'skills/changed', params: {} })).unref()
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
        send({
          id,
          result: { config: { [AUTO_COMPACT_KEY]: limit }, origins: {}, layers: null },
        })
        return true
      case 'config/value/write':
        if (params?.keyPath !== AUTO_COMPACT_KEY || params.mergeStrategy !== 'replace') {
          send({
            id,
            error: { code: INVALID_REQUEST, message: `Mock does not write ${params?.keyPath}` },
          })
          return true
        }
        limit = params.value
        send({
          id,
          result: {
            status: 'ok',
            version: 'mock',
            filePath: '/mock/.codex/config.toml',
            overriddenMetadata: null,
          },
        })
        return true
      default:
        return false
    }
  }
}
