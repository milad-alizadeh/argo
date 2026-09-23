import type { CodexModelCatalog } from './protocol'
import { readModelCatalog } from './protocol'

export type ModelListRequest = (
  params: { cursor?: string; limit?: number; includeHidden?: boolean },
  decode: (value: unknown) => CodexModelCatalog,
) => Promise<CodexModelCatalog>

type CatalogKey = { executablePath: string; version: string }

// The executable identity, rather than app lifetime, owns the cached advertised choices.
export class CodexModelCatalogCache {
  private key: CatalogKey | null = null
  private catalog: CodexModelCatalog | null = null
  private pending: Promise<CodexModelCatalog> | null = null

  async get(key: CatalogKey, request: ModelListRequest): Promise<CodexModelCatalog> {
    if (
      this.key?.executablePath === key.executablePath &&
      this.key.version === key.version &&
      this.catalog !== null
    )
      return this.catalog
    if (this.key?.executablePath !== key.executablePath || this.key.version !== key.version) {
      this.key = key
      this.catalog = null
      this.pending = null
    }
    if (this.pending !== null) return this.pending
    const pending = this.loadCatalog(request)
      .then((catalog) => {
        if (this.key?.executablePath === key.executablePath && this.key.version === key.version) {
          this.catalog = catalog
        }
        return catalog
      })
      .finally(() => {
        if (this.pending === pending) this.pending = null
      })
    this.pending = pending
    return pending
  }

  private async loadCatalog(request: ModelListRequest): Promise<CodexModelCatalog> {
    const data: CodexModelCatalog['data'] = []
    let cursor: string | undefined
    let nextCursor: string | null = null
    do {
      const page = await request(
        { includeHidden: false, limit: 100, ...(cursor === undefined ? {} : { cursor }) },
        readModelCatalog,
      )
      data.push(...page.data)
      nextCursor = page.nextCursor
      cursor = nextCursor ?? undefined
    } while (cursor !== undefined)
    return { data, nextCursor }
  }
}

export { readModelCatalog }
