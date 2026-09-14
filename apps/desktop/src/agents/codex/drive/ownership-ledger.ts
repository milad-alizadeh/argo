import { z } from 'zod'
import { isRecord } from '../../../boundary'
import { readDocumentSync, writeDocumentSync } from '../../../core/storage/portable-file'

const ownerSchema = z.strictObject({
  pid: z.number().int().positive(),
  registry: z.string().min(1),
})
const entrySchema = z.strictObject({
  cwd: z.string().min(1),
  owner: ownerSchema.nullable(),
})
const ledgerSchema = z.record(z.string(), entrySchema)

type Owner = z.infer<typeof ownerSchema>
type Ledger = z.infer<typeof ledgerSchema>

export type CodexOwnershipStanding = 'never-owned' | 'orphaned' | 'held-here' | 'held-elsewhere'

export type CodexOwnershipLedger = {
  bind: (sessionId: string, cwd: string) => void
  release: (sessionId: string) => void
  resumeTarget: (sessionId: string) => { cwd: string } | null
  orphans: () => ReadonlySet<string>
}

function readLedger(file: string): Ledger {
  const read = readDocumentSync(file)
  if (!read.ok) return {}
  const parsed = ledgerSchema.safeParse(read.document)
  return parsed.success ? parsed.data : {}
}

export function createCodexOwnershipLedger(options: {
  path: string
  owner: Owner
  isAlive: (pid: number) => boolean
}): CodexOwnershipLedger {
  const mine: Ledger = {}
  const entries = (): Ledger => ({ ...mine, ...readLedger(options.path) })
  const standing = (entry: Ledger[string] | undefined): CodexOwnershipStanding => {
    if (entry === undefined) return 'never-owned'
    if (entry.owner === null) return 'orphaned'
    if (entry.owner.pid === options.owner.pid && entry.owner.registry === options.owner.registry)
      return 'held-here'
    return options.isAlive(entry.owner.pid) ? 'held-elsewhere' : 'orphaned'
  }
  const write = (sessionId: string, entry: Ledger[string]) => {
    mine[sessionId] = entry
    writeDocumentSync(options.path, { ...readLedger(options.path), [sessionId]: entry })
  }

  return {
    bind(sessionId, cwd) {
      write(sessionId, { cwd, owner: options.owner })
    },
    release(sessionId) {
      const entry = entries()[sessionId]
      if (entry !== undefined) write(sessionId, { ...entry, owner: null })
    },
    resumeTarget(sessionId) {
      const entry = entries()[sessionId]
      return standing(entry) === 'orphaned' && entry !== undefined ? { cwd: entry.cwd } : null
    },
    orphans() {
      return new Set(
        Object.entries(entries())
          .filter(([, entry]) => standing(entry) === 'orphaned')
          .map(([sessionId]) => sessionId),
      )
    },
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return isRecord(error) && error.code === 'EPERM'
  }
}
