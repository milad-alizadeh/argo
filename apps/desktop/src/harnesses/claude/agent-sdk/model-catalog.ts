import { execFile } from 'node:child_process'
import { type ModelInfo, type Query, query } from '@anthropic-ai/claude-agent-sdk'
import {
  type ClaudeModelCatalog,
  claudeModelCatalogSchema,
} from '@/domains/sessions/contract/claude-model-catalog'
import { executableVersion } from '@/harnesses/cli/executable-version'

type ExecutableIdentity = { executablePath: string; version: string }
type ClaudeCapabilities = { models: readonly ModelInfo[]; permissionModes: readonly string[] }
export type ClaudeModelQuery = () => Promise<ClaudeCapabilities>

export class ClaudeModelCatalogCache {
  private identity: ExecutableIdentity | null = null
  private catalog: ClaudeModelCatalog | null = null
  private pending: Promise<ClaudeModelCatalog | null> | null = null

  async get(
    identity: ExecutableIdentity,
    read: ClaudeModelQuery,
  ): Promise<ClaudeModelCatalog | null> {
    if (
      this.identity?.executablePath === identity.executablePath &&
      this.identity.version === identity.version &&
      this.catalog !== null
    )
      return this.catalog
    if (
      this.identity?.executablePath !== identity.executablePath ||
      this.identity.version !== identity.version
    ) {
      this.identity = identity
      this.catalog = null
      this.pending = null
    }
    if (this.pending !== null) return this.pending
    const pending = read()
      .then(({ models, permissionModes }) => {
        const parsed = claudeModelCatalogSchema.safeParse({
          data: models.map(
            ({ value, resolvedModel, displayName, description, supportedEffortLevels }) => ({
              value,
              resolvedModel,
              displayName,
              description,
              supportedEffortLevels: supportedEffortLevels ?? [],
            }),
          ),
          supportedPermissionModes: permissionModes,
        })
        const catalog = parsed.success && parsed.data.data.length > 0 ? parsed.data : null
        if (
          catalog !== null &&
          this.identity?.executablePath === identity.executablePath &&
          this.identity.version === identity.version
        )
          this.catalog = catalog
        return catalog
      })
      .catch(() => null)
      .finally(() => {
        if (this.pending === pending) this.pending = null
      })
    this.pending = pending
    return pending
  }
}

export async function readClaudeModelCatalog(options: {
  executablePath: string | null
  readModels?: (executablePath: string) => Promise<readonly ModelInfo[]>
  cache: ClaudeModelCatalogCache
}): Promise<ClaudeModelCatalog | null> {
  const executablePath = options.executablePath
  if (executablePath === null) return null
  try {
    const version = await executableVersion(executablePath)
    return options.cache.get({ executablePath, version }, async () => {
      const [models, permissionModes] = await Promise.all([
        (options.readModels ?? readSupportedModels)(executablePath),
        readSupportedPermissionModes(executablePath),
      ])
      return { models, permissionModes }
    })
  } catch {
    return null
  }
}

function readSupportedPermissionModes(executablePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(executablePath, ['--help'], { encoding: 'utf8', timeout: 3_000 }, (error, stdout) => {
      if (error !== null) {
        reject(error)
        return
      }
      const modes = permissionModesFromHelp(stdout)
      if (modes.length === 0) {
        reject(new Error('Claude help does not list permission modes.'))
        return
      }
      resolve(modes)
    })
  })
}

export function permissionModesFromHelp(help: string): string[] {
  const section = help.split('--permission-mode <mode>')[1]?.split(/\n {2}--/)[0]
  const choices = section?.match(/\(choices:\s*([^)]*)\)/)?.[1]
  return choices === undefined
    ? []
    : [...choices.matchAll(/"([^"]+)"/g)].flatMap(([, mode]) => (mode ? [mode] : []))
}

async function readSupportedModels(executablePath: string): Promise<readonly ModelInfo[]> {
  const prompt = (async function* () {})()
  const session: Query = query({ prompt, options: { pathToClaudeCodeExecutable: executablePath } })
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const initialized = await Promise.race([
      session.initializationResult(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Claude model discovery timed out.')), 10_000)
      }),
    ])
    return initialized.models
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    session.close()
  }
}
