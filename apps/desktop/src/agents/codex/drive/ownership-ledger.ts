import { z } from 'zod'
import { isRecord } from '../../../boundary'
import { readDocumentSync, writeDocumentSync } from '../../../core/storage/portable-file'

const ownerSchema = z.strictObject({
  pid: z.number().int().positive(),
  registry: z.string().min(1),
})
const entrySchema = z.strictObject({
  owner: ownerSchema.nullable(),
})
const ledgerSchema = z.record(z.string(), entrySchema)

type Owner = z.infer<typeof ownerSchema>
type Ledger = z.infer<typeof ledgerSchema>

// Whether an Argo window currently holds a Session's app-server thread. Per machine, never
// committed, and not a roster. Origin does not matter: a thread this Argo never started grades
// the same as one it released.
export type CodexOwnershipStanding = 'resumable' | 'held-here' | 'held-elsewhere'

export type CodexOwnershipLedger = {
  bind: (sessionId: string) => void
  release: (sessionId: string) => void
  standing: (sessionId: string) => CodexOwnershipStanding
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
  const grade = (entry: Ledger[string] | undefined): CodexOwnershipStanding => {
    if (entry === undefined || entry.owner === null) return 'resumable'
    if (entry.owner.pid === options.owner.pid && entry.owner.registry === options.owner.registry)
      return 'held-here'
    return options.isAlive(entry.owner.pid) ? 'held-elsewhere' : 'resumable'
  }
  const write = (sessionId: string, entry: Ledger[string]) => {
    mine[sessionId] = entry
    writeDocumentSync(options.path, { ...readLedger(options.path), [sessionId]: entry })
  }

  return {
    bind(sessionId) {
      write(sessionId, { owner: options.owner })
    },
    release(sessionId) {
      write(sessionId, { owner: null })
    },
    standing: (sessionId) => grade(entries()[sessionId]),
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
