import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import type { Database } from '@/database/database'
import {
  composerDraftContentSchema,
  composerDraftTargetSchema,
  composerDraftValueSchema,
  insertComposerDraft,
  readComposerDraftForTarget,
} from '../database/composer-draft'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  target: composerDraftTargetSchema,
  content: composerDraftContentSchema,
})

export function composerDraftCreateProcedure(database: Database) {
  return t.procedure
    .input(inputSchema)
    .output(composerDraftValueSchema)
    .mutation(({ input }) => {
      const existing = readComposerDraftForTarget(database, input.target)
      return (
        existing ??
        insertComposerDraft(database, {
          id: `draft-${randomUUID()}`,
          target: input.target,
          ...input.content,
        })
      )
    })
}
