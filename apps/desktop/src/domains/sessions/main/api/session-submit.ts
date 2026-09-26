import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionAttachmentInputSchema } from '@/domains/sessions/api/attachments'
import { resolveWorkspacePath } from '@/domains/workspaces/main/workspace-resolve-path'
import { harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import {
  deleteComposerDraft,
  draftTurnConfigurationSchema,
  readComposerDraft,
} from '../database/composer-draft'
import type { LiveSessionSupervisorActor } from '../live/live-session-supervisor-machine'
import type { SessionRenameContext } from './session-rename'

const t = initTRPC.create()
const commandSchema = z.strictObject({
  commandId: identifierSchema,
  prompt: z.string(),
  attachments: z.array(sessionAttachmentInputSchema),
  turnConfiguration: draftTurnConfigurationSchema,
})
export const sessionStartInputSchema = commandSchema.extend({
  harness: harnessSchema,
  projectId: identifierSchema,
  workspaceId: identifierSchema,
  cwd: z.string().min(1),
})
export const sessionSendInputSchema = commandSchema.extend({ sessionId: identifierSchema })
const inputSchema = z.strictObject({
  draftId: identifierSchema,
  expectedRevision: z.number().int().nonnegative(),
  commandId: identifierSchema,
})
const outputSchema = z.strictObject({ sessionId: identifierSchema })

export type SessionStartInput = z.infer<typeof sessionStartInputSchema>
export type SessionSendInput = z.infer<typeof sessionSendInputSchema>
export type SessionSubmitInput = z.infer<typeof inputSchema>
export type SessionProcedureContext = SessionRenameContext & {
  database: Database
  supervisor: LiveSessionSupervisorActor
}

function sendToSupervisor(
  context: SessionProcedureContext,
  input: SessionSubmitInput,
): Promise<{ sessionId: string }> {
  const draft = readComposerDraft(context.database, input.draftId)
  if (draft === null) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-draft' })
  if (draft.revision !== input.expectedRevision) {
    throw new TRPCError({ code: 'CONFLICT', message: 'stale-draft' })
  }
  return new Promise((resolve, reject) => {
    const reply = { resolve, reject }
    const command = {
      commandId: input.commandId,
      prompt: draft.prompt,
      attachments: draft.attachments,
      turnConfiguration: draft.turnConfiguration,
    }
    if (draft.target.type === 'project') {
      if (draft.target.harness === 'claude' && draft.attachments.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Claude Session attachments are not supported.',
        })
      }
      const cwd = resolveWorkspacePath(context.database, draft.target)
      if (cwd === null) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'workspace-not-in-project' })
      }
      context.supervisor.send({
        type: 'Start',
        pendingId: `optimistic:${draft.id}`,
        input: {
          ...command,
          harness: draft.target.harness,
          projectId: draft.target.projectId,
          workspaceId: draft.target.workspaceId,
          cwd,
        },
        reply,
      })
      return
    }
    const stored = context.database
      .select({ harness: sessionTable.harness })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, draft.target.sessionId))
      .get()
    if (stored === undefined) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
    }
    const harness = harnessSchema.parse(stored.harness)
    if (harness === 'claude' && draft.attachments.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Claude Session attachments are not supported.',
      })
    }
    context.supervisor.send({
      type: 'Send',
      input: { ...command, sessionId: draft.target.sessionId },
      reply,
    })
  })
}

export function sessionSubmitProcedure(context: SessionProcedureContext) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ input }) => {
      const accepted = await sendToSupervisor(context, input)
      deleteComposerDraft(context.database, input.draftId, input.expectedRevision)
      return accepted
    })
}
