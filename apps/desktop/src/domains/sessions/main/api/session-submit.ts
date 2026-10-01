import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionAttachmentInputSchema } from '@/domains/sessions/api/attachments'
import { resolveWorkspacePath } from '@/domains/workspaces/main'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { deleteComposerDraft, draftTurnConfigurationSchema, readComposerDraft } from '../database'
import { type LiveSessionSupervisorActor, SessionSubmitRejectedError } from '../live'
import type { SessionListChanges } from './session-list-changes'

const t = initTRPC.create()
const commandSchema = z.strictObject({
  commandId: identifierSchema,
  prompt: z.string(),
  attachments: z.array(sessionAttachmentInputSchema),
  turnConfiguration: draftTurnConfigurationSchema,
})
const sessionStartInputSchema = commandSchema.extend({
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
const sessionSendInputSchema = commandSchema.extend({
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
type SessionSubmitInput = z.infer<typeof inputSchema>
export type SessionProcedureContext = {
  database: Database
  supervisor: LiveSessionSupervisorActor
  ensureManagedWorkspace: (
    projectId: string,
    draftId: string,
  ) => Promise<{ id: string; path: string }>
  acceptsAttachments: (harness: Harness) => boolean
  // The asserted Session to Ticket link store the Ticket domain owns (ADR-0017).
  ticketLinks: {
    connect: (
      sessionId: string,
      ticket: { projectId: string; key: string },
      createdAt: string,
    ) => Promise<void>
  }
  changes: SessionListChanges
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

function rejectUnsupportedAttachments(
  context: SessionProcedureContext,
  harness: Harness,
  attachments: unknown[],
): void {
  if (context.acceptsAttachments(harness) || attachments.length === 0) return
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'This Harness does not accept Session attachments.',
  })
}

async function prepareProjectDraft(
  input: Omit<SupervisorDraftRequest, 'reply'>,
): Promise<SessionStartInput | null> {
  const { context, draft, command } = input
  if (draft.target.type !== 'project') return null
  const target = draft.target
  rejectUnsupportedAttachments(context, target.harness, draft.attachments)
  const created =
    target.workspaceId === null
      ? await context.ensureManagedWorkspace(target.projectId, draft.id).catch(() => {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'worktree-create-failed' })
        })
      : null
  const workspaceId = created?.id ?? target.workspaceId
  const cwd =
    created?.path ??
    (workspaceId === null
      ? null
      : resolveWorkspacePath(context.database, { projectId: target.projectId, workspaceId }))
  if (workspaceId === null || cwd === null)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'workspace-not-in-project' })
  return {
    ...command,
    harness: target.harness,
    projectId: target.projectId,
    workspaceId,
    cwd,
  }
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
  rejectUnsupportedAttachments(context, harness, draft.attachments)
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
    intentId: `optimistic:${draft.id}:${draft.revision}`,
    input: { ...command, sessionId: draft.target.sessionId, resume: { ...stored, harness, cwd } },
    reply,
  })
}

// A new Session's first draft Ticket becomes its primary Ticket (#2151); a later send only refers.
async function linkFirstTicket(
  context: SessionProcedureContext,
  draft: NonNullable<ReturnType<typeof readComposerDraft>>,
  sessionId: string,
): Promise<void> {
  const [first] = draft.ticketContext
  if (draft.target.type !== 'project' || first === undefined) return
  const ticket = { projectId: draft.target.projectId, key: first.key }
  await context.ticketLinks.connect(sessionId, ticket, new Date().toISOString())
  context.changes.changed([sessionId])
}

async function sendToSupervisor(
  context: SessionProcedureContext,
  input: SessionSubmitInput,
): Promise<{ sessionId: string }> {
  const draft = readComposerDraft(context.database, input.draftId)
  if (draft === null) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-draft' })
  if (draft.revision !== input.expectedRevision) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'stale-draft' })
  }
  const command = commandForDraft(draft, input)
  const request = { context, draft, command }
  const startInput = draft.target.type === 'project' ? await prepareProjectDraft(request) : null
  const accepted = await new Promise<{ sessionId: string }>((resolve, reject) => {
    const reply = { resolve, reject }
    if (startInput !== null) {
      context.supervisor.send({
        type: 'Start',
        pendingId: `optimistic:${draft.id}:${draft.revision}`,
        input: startInput,
        reply,
      })
    } else sendSessionDraft({ ...request, reply })
  })
  // The Turn is already accepted, so a failed link write is reported and never fails the send.
  await linkFirstTicket(context, draft, accepted.sessionId).catch((error: unknown) =>
    console.warn('The new Session could not be linked to its Ticket.', error),
  )
  return accepted
}

export function sessionSubmitProcedure(context: SessionProcedureContext) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .mutation(async ({ input }) => {
      const accepted = await sendToSupervisor(context, input).catch((error: unknown) => {
        if (error instanceof SessionSubmitRejectedError)
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: error.message })
        throw error
      })
      // The Turn is already accepted, so a newer revision saved meanwhile stays as the next draft.
      deleteComposerDraft(context.database, input.draftId, input.expectedRevision)
      return accepted
    })
}
