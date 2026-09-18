// Whether an Argo window currently holds a Session channel. Per machine, never committed, and not
// a roster: no titles, no order and no content, only the window that holds each Session id.
import { z } from 'zod'
import { readDocumentSync, writeDocumentSync } from '../../../platform/main/storage/portable-file'
import { isRecord } from '../../../shared/validation'

const windowSchema = z.strictObject({
  pid: z.number().int().positive(),
  registry: z.string().min(1),
})
const ledgerSchema = z.record(z.string(), z.strictObject({ owner: windowSchema.nullable() }))

type Ledger = z.infer<typeof ledgerSchema>

// `held-elsewhere` is the only refusal. Every other Session is resumable.
export type OwnershipStanding = 'resumable' | 'held-here' | 'held-elsewhere'
export type WindowIdentity = z.infer<typeof windowSchema>

export type OwnershipLedger = {
  bind: (sessionId: string) => void
  release: (sessionId: string) => void
  standing: (sessionId: string) => OwnershipStanding
}

function readLedger(file: string): Ledger {
  const read = readDocumentSync(file)
  if (!read.ok) return {}
  const parsed = ledgerSchema.safeParse(read.document)
  if (!parsed.success) return {}
  return parsed.data
}

export function createOwnershipLedger(options: {
  path: string
  window: WindowIdentity
  isAlive: (pid: number) => boolean
}): OwnershipLedger {
  // This launch's own claims, so a ledger that cannot be written costs the next launch, not this one.
  const mine: Ledger = {}
  const write = (sessionId: string, owner: WindowIdentity | null) => {
    mine[sessionId] = { owner }
    // ADR-0026: a failed save costs only the next launch, which reads this Session as external.
    // `mine` above already holds the claim for this one, whatever the disk says.
    writeDocumentSync(options.path, { ...readLedger(options.path), [sessionId]: { owner } })
  }
  // The file wins: another window may have resumed a Session this one let go.
  const entries = (): Ledger => ({ ...mine, ...readLedger(options.path) })
  const grade = (entry: Ledger[string] | undefined): OwnershipStanding => {
    if (entry === undefined || entry.owner === null) return 'resumable'
    if (entry.owner.pid === options.window.pid && entry.owner.registry === options.window.registry)
      return 'held-here'
    return options.isAlive(entry.owner.pid) ? 'held-elsewhere' : 'resumable'
  }
  return {
    bind: (sessionId) => write(sessionId, options.window),
    release: (sessionId) => write(sessionId, null),
    standing: (sessionId) => grade(entries()[sessionId]),
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
