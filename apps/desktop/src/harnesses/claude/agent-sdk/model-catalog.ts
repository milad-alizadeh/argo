import { type ModelInfo, type Query, query } from '@anthropic-ai/claude-agent-sdk'
import {
  type ClaudeModelCatalog,
  claudeModelCatalogSchema,
} from '@/domains/sessions/contract/claude-model-catalog'
import { executableVersion } from '@/harnesses/cli/executable-version'

type ExecutableIdentity = { executablePath: string; version: string }
export type ClaudeModelQuery = () => Promise<readonly ModelInfo[]>

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
      .then((models) => {
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
    return options.cache.get({ executablePath, version }, () =>
      (options.readModels ?? readSupportedModels)(executablePath),
    )
  } catch {
    return null
  }
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
