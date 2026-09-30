import { initTRPC } from '@trpc/server'
import type { Database } from '@/database/database'
import {
  composerDraftTargetSchema,
  composerDraftValueSchema,
  readComposerDraftForTarget,
} from '../database'

const t = initTRPC.create()

export function composerDraftReadProcedure(database: Database) {
  return t.procedure
    .input(composerDraftTargetSchema)
    .output(composerDraftValueSchema.nullable())
    .query(({ input }) => readComposerDraftForTarget(database, input))
}
