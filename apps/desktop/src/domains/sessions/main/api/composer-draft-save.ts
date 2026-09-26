import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { identifierSchema } from '@/shared/validation'
import {
  composerDraftContentSchema,
  composerDraftTargetSchema,
  composerDraftValueSchema,
  readComposerDraft,
  updateComposerDraft,
} from '../database/composer-draft'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  id: identifierSchema,
  expectedRevision: z.number().int().nonnegative(),
  target: composerDraftTargetSchema,
  content: composerDraftContentSchema,
})

function sameOwner(
  current: z.infer<typeof composerDraftTargetSchema>,
  next: z.infer<typeof composerDraftTargetSchema>,
) {
  if (current.type !== next.type) return false
  return current.type === 'project'
    ? current.projectId === (next.type === 'project' ? next.projectId : null)
    : current.sessionId === (next.type === 'session' ? next.sessionId : null)
}

export function composerDraftSaveProcedure(database: Database) {
  return t.procedure
    .input(inputSchema)
    .output(composerDraftValueSchema)
    .mutation(({ input }) => {
      const current = readComposerDraft(database, input.id)
      if (current === null) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-draft' })
      if (!sameOwner(current.target, input.target)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'draft-target-cannot-change' })
      }
      const saved = updateComposerDraft(database, {
        id: input.id,
        expectedRevision: input.expectedRevision,
        target: input.target,
        ...input.content,
      })
      if (saved === null) throw new TRPCError({ code: 'CONFLICT', message: 'stale-draft' })
      return saved
    })
}
