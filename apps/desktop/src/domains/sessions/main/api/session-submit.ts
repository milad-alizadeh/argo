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
const sessionResumeSchema = z.strictObject({
  harness: harnessSchema,
  nativeId: identifierSchema,
  projectId: identifierSchema.nullable(),
  workspaceId: identifierSchema.nullable(),
  cwd: z.string().min(1),
})
export const sessionSendInputSchema = commandSchema.extend({
  sessionId: identifierSchema,
  resume: sessionResumeSchema,
})
const inputSchema = z.strictObject({
  draftId: identifierSchema,
  expectedRevision: z.number().int().nonnegative(),
  commandId: identifierSchema,
})
const outputSchema = z.strictObject({ sessionId: identifierSchema })

export type SessionStartInput = z.infer<typeof sessionStartInputSchema>
export type SessionSendInput = z.infer<typeof sessionSendInputSchema>
export type SessionLiveInput = SessionStartInput | SessionSendInput
export type SessionSubmitInput = z.infer<typeof inputSchema>
export type SessionProcedureContext = SessionRenameContext & {
  database: Database
  supervisor: LiveSessionSupervisorActor
}
type SupervisorDraftRequest = {
  context: SessionProcedureContext
  draft: NonNullable<ReturnType<typeof readComposerDraft>>
  command: ReturnType<typeof commandForDraft>
  reply: { resolve: (value: { sessionId: string }) => void; reject: (error: Error) => void }
}

function commandForDraft(
  draft: NonNullable<ReturnType<typeof readComposerDraft>>,
  input: SessionSubmitInput,
) {
  return {
    commandId: input.commandId,
    prompt: draft.prompt,
    attachments: draft.attachments,
    turnConfiguration: draft.turnConfiguration,
  }
}

function rejectUnsupportedAttachments(harness: string, attachments: unknown[]): void {
  if (harness === 'claude' && attachments.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Claude Session attachments are not supported.',
    })
  }
}

function startProjectDraft(input: SupervisorDraftRequest) {
  const { context, draft, command, reply } = input
  if (draft.target.type !== 'project') return false
  rejectUnsupportedAttachments(draft.target.harness, draft.attachments)
  const cwd = resolveWorkspacePath(context.database, draft.target)
  if (cwd === null)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'workspace-not-in-project' })
  context.supervisor.send({
    type: 'Start',
    pendingId: `optimistic:${draft.id}:${draft.revision}`,
    input: { ...command, ...draft.target, cwd },
    reply,
  })
  return true
}

function sendSessionDraft(input: SupervisorDraftRequest) {
  const { context, draft, command, reply } = input
  if (draft.target.type !== 'session') return
  const stored = context.database
    .select({
      harness: sessionTable.harness,
      nativeId: sessionTable.nativeId,
      projectId: sessionTable.projectId,
      workspaceId: sessionTable.workspaceId,
      cwd: sessionTable.cwd,
    })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, draft.target.sessionId))
    .get()
  if (stored === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  const harness = harnessSchema.parse(stored.harness)
  rejectUnsupportedAttachments(harness, draft.attachments)
  const cwd =
    stored.cwd ??
    (stored.projectId !== null && stored.workspaceId !== null
      ? resolveWorkspacePath(context.database, {
          projectId: stored.projectId,
          workspaceId: stored.workspaceId,
        })
      : null)
  if (cwd === null)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'missing-session-working-directory' })
  context.supervisor.send({
    type: 'Send',
    input: { ...command, sessionId: draft.target.sessionId, resume: { ...stored, harness, cwd } },
    reply,
  })
}

function sendToSupervisor(
  context: SessionProcedureContext,
  input: SessionSubmitInput,
): Promise<{ sessionId: string }> {
  const draft = readComposerDraft(context.database, input.draftId)
  if (draft === null) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-draft' })
  if (draft.revision !== input.expectedRevision) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'stale-draft' })
  }
  const command = commandForDraft(draft, input)
  return new Promise((resolve, reject) => {
    const reply = { resolve, reject }
    const request = { context, draft, command, reply }
    if (startProjectDraft(request)) return
    sendSessionDraft(request)
  })
}

export function sessionSubmitProcedure(context: SessionProcedureContext) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ input }) => {
      const accepted = await sendToSupervisor(context, input)
      const deleted = deleteComposerDraft(context.database, input.draftId, input.expectedRevision)
      if (!deleted && readComposerDraft(context.database, input.draftId) !== null) {
        throw new TRPCError({ code: 'CONFLICT', message: 'stale-draft' })
      }
      return accepted
    })
}
