// ADR-0026: which Sessions an Argo has held, and whether one holds each now. Per machine, never
// committed, and not a roster: no titles, no order and no content, only the owner of each id.
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { isRecord } from '@/boundary'

const ownerSchema = z.strictObject({
  pid: z.number().int().positive(),
  registry: z.string().min(1),
})
// A null owner is a released claim: Argo held the Session and let it go.
const ledgerSchema = z.record(z.string(), z.strictObject({ owner: ownerSchema.nullable() }))

type Owner = z.infer<typeof ownerSchema>
type Ledger = z.infer<typeof ledgerSchema>

export type OwnershipStanding = 'never-owned' | 'orphaned' | 'held-here' | 'held-elsewhere'

export type OwnershipLedger = {
  bind: (sessionId: string) => void
  release: (sessionId: string) => void
  standing: (sessionId: string) => OwnershipStanding
  orphans: () => ReadonlySet<string>
}

function readLedger(file: string): Ledger {
  try {
    const parsed = ledgerSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

// The pid alone is not an owner: one Argo process runs a registry per window, and on the pid
// alone a second window would resume what the first is steering.
export function createOwnershipLedger(options: {
  path: string
  owner: Owner
  isAlive: (pid: number) => boolean
}): OwnershipLedger {
  // This launch's own claims, so a ledger that cannot be written costs the next launch, not this one.
  const mine: Ledger = {}
  const write = (sessionId: string, owner: Owner | null) => {
    mine[sessionId] = { owner }
    try {
      writeFileSync(
        options.path,
        JSON.stringify({ ...readLedger(options.path), [sessionId]: { owner } }),
      )
    } catch {
      // ADR-0026: grading stays right until quit, and the next launch reads this Session external.
    }
  }
  // The file wins: another window may have resumed a Session this one let go.
  const entries = (): Ledger => ({ ...mine, ...readLedger(options.path) })
  const grade = (entry: Ledger[string] | undefined): OwnershipStanding => {
    if (entry === undefined) return 'never-owned'
    if (entry.owner === null) return 'orphaned'
    if (entry.owner.pid === options.owner.pid && entry.owner.registry === options.owner.registry)
      return 'held-here'
    return options.isAlive(entry.owner.pid) ? 'held-elsewhere' : 'orphaned'
  }
  return {
    bind: (sessionId) => write(sessionId, options.owner),
    release: (sessionId) => write(sessionId, null),
    standing: (sessionId) => grade(entries()[sessionId]),
    orphans: () =>
      new Set(
        Object.entries(entries())
          .filter(([, entry]) => grade(entry) === 'orphaned')
          .map(([sessionId]) => sessionId),
      ),
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM is a live process this user may not signal.
    return isRecord(error) && error.code === 'EPERM'
  }
}
