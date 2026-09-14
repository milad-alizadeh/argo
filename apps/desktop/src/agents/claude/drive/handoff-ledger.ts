// ADR-0026: which Session a handoff sent its work to, and which one it came from. Per machine,
// never committed — a source→destination edge, recorded once the fresh Session exists so the
// relationship survives a restart through the normal discovery path.
import { z } from 'zod'
import { readDocumentSync, writeDocumentSync } from '@/core/storage/portable-file'

const ledgerSchema = z.record(z.string(), z.string())
type Ledger = z.infer<typeof ledgerSchema>

export type HandoffEdges = { to: string | null; from: string | null }

export type HandoffLedger = {
  record: (sourceId: string, destinationId: string) => void
  edgesFor: (sessionId: string) => HandoffEdges
}

function readLedger(file: string): Ledger {
  const read = readDocumentSync(file)
  if (!read.ok) return {}
  const parsed = ledgerSchema.safeParse(read.document)
  return parsed.success ? parsed.data : {}
}

export function createHandoffLedger(options: { path: string }): HandoffLedger {
  // This launch's own edges, so a ledger that cannot be written costs the next launch, not this one.
  const mine: Ledger = {}
  const entries = (): Ledger => ({ ...mine, ...readLedger(options.path) })
  return {
    record: (sourceId, destinationId) => {
      mine[sourceId] = destinationId
      writeDocumentSync(options.path, { ...readLedger(options.path), [sourceId]: destinationId })
    },
    edgesFor: (sessionId) => {
      const all = entries()
      const to = all[sessionId] ?? null
      const from =
        Object.entries(all).find(([, destinationId]) => destinationId === sessionId)?.[0] ?? null
      return { to, from }
    },
  }
}
