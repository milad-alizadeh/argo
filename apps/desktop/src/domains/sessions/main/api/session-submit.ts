import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { type SessionWorktree, sessionWorktreeSchema } from '@/database/session/validation'
import { sessionAttachmentInputSchema } from '@/domains/sessions/api/attachments'
import { pendingSessionId } from '@/domains/sessions/api/pending-session'
import type { SessionSubmitRejection } from '@/domains/sessions/api/session-submit-rejection'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { deleteComposerDraft, draftTurnConfigurationSchema, readComposerDraft } from '../database'
import { type LiveSessionSupervisorActor, SessionSubmitRejectedError } from '../live'
import { folderPresent, mainCheckout } from '../worktree'
import { type GoneWorktreeContext, leaveGoneWorktree } from './session-gone-worktree'

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
  // Null runs the Session in the Project's main checkout.
  worktree: sessionWorktreeSchema.nullable(),
  cwd: z.string().min(1),
})
const sessionResumeSchema = z.strictObject({
  harness: harnessSchema,
  nativeId: identifierSchema,
  projectId: identifierSchema.nullable(),
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
// `worktreeGone` names the worktree folder a resumed Session lost; it continued in the main checkout.
const outputSchema = z.strictObject({
  sessionId: identifierSchema,
  worktreeGone: z.string().min(1).nullable(),
})

export type SessionStartInput = z.infer<typeof sessionStartInputSchema>
export type SessionSendInput = z.infer<typeof sessionSendInputSchema>
export type SessionLiveInput = SessionStartInput | SessionSendInput
type SessionSubmitInput = z.infer<typeof inputSchema>
export type SessionProcedureContext = GoneWorktreeContext & {
  database: Database
  supervisor: LiveSessionSupervisorActor
  createWorktree: (
    projectId: string,
    draftId: string,
    from: string | null,
  ) => Promise<SessionWorktree>
  acceptsAttachments: (harness: Harness) => boolean
}
type Draft = NonNullable<ReturnType<typeof readComposerDraft>>
type DraftTarget<Type extends Draft['target']['type']> = Extract<Draft['target'], { type: Type }>
type DraftRequest<Type extends Draft['target']['type']> = {
  context: SessionProcedureContext
  draft: Draft
  target: DraftTarget<Type>
  command: ReturnType<typeof commandForDraft>
}

function commandForDraft(draft: Draft, input: SessionSubmitInput) {
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

// A Harness given a missing folder fails in its own way, or not at all, so every one stops here.
async function rejectMissingFolder(folder: string): Promise<void> {
  if (!(await folderPresent(folder)))
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'folder-missing' satisfies SessionSubmitRejection,
    })
}

// The folder a new Session runs in: a new worktree made for it, or the main checkout.
async function chosenFolder(
  context: SessionProcedureContext,
  target: DraftTarget<'project'>,
  draftId: string,
): Promise<Pick<SessionStartInput, 'worktree' | 'cwd'>> {
  switch (target.worktree.type) {
    case 'new': {
      const created = await context
        .createWorktree(target.projectId, draftId, target.worktree.from)
        .catch(() => {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'worktree-create-failed' satisfies SessionSubmitRejection,
          })
        })
      return { worktree: created, cwd: created.path }
    }
    case 'main': {
      const main = await mainCheckout(context.database, target.projectId)
      if (main === null) throw new TRPCError({ code: 'BAD_REQUEST', message: 'missing-project' })
      return { worktree: null, cwd: main }
    }
  }
}

async function prepareStart(input: DraftRequest<'project'>): Promise<SessionStartInput> {
  const { context, draft, target, command } = input
  rejectUnsupportedAttachments(context, target.harness, draft.attachments)
  const folder = await chosenFolder(context, target, draft.id)
  await rejectMissingFolder(folder.cwd)
  return { ...command, harness: target.harness, projectId: target.projectId, ...folder }
}

// The worktree folder a Send found gone and left, or null; a gone one with nowhere to go refuses.
async function leftWorktree(
  context: SessionProcedureContext,
  sessionId: string,
): Promise<string | null> {
  const left = await leaveGoneWorktree(context, sessionId)
  switch (left.type) {
    case 'kept':
      return null
    case 'moved':
      return left.gone
    case 'stranded':
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'folder-missing' satisfies SessionSubmitRejection,
      })
  }
}

type PreparedSend = { input: SessionSendInput; worktreeGone: string | null }

async function prepareSend(input: DraftRequest<'session'>): Promise<PreparedSend> {
  const { context, draft, target, command } = input
  const sessionId = target.sessionId
  // Opening the Session usually left a gone worktree already; a Send still checks.
  const worktreeGone = await leftWorktree(context, sessionId)
  const stored = context.database
    .select({
      harness: sessionTable.harness,
      nativeId: sessionTable.nativeId,
      projectId: sessionTable.projectId,
      cwd: sessionTable.cwd,
      worktreePath: sessionTable.worktreePath,
    })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (stored === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  const harness = harnessSchema.parse(stored.harness)
  rejectUnsupportedAttachments(context, harness, draft.attachments)
  const cwd = stored.cwd ?? stored.worktreePath
  if (cwd === null)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'missing-session-working-directory' })
  await rejectMissingFolder(cwd)
  const resume = { harness, nativeId: stored.nativeId, projectId: stored.projectId, cwd }
  return { input: { ...command, sessionId, resume }, worktreeGone }
}

async function sendToSupervisor(
  context: SessionProcedureContext,
  input: SessionSubmitInput,
): Promise<z.infer<typeof outputSchema>> {
  const draft = readComposerDraft(context.database, input.draftId)
  if (draft === null) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-draft' })
  if (draft.revision !== input.expectedRevision) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'stale-draft' })
  }
  const command = commandForDraft(draft, input)
  const pendingId = pendingSessionId(draft)
  const { target } = draft
  switch (target.type) {
    case 'project': {
      const startInput = await prepareStart({ context, draft, target, command })
      const accepted = await new Promise<{ sessionId: string }>((resolve, reject) =>
        context.supervisor.send({
          type: 'Start',
          pendingId,
          input: startInput,
          reply: { resolve, reject },
        }),
      )
      return { sessionId: accepted.sessionId, worktreeGone: null }
    }
    case 'session': {
      const prepared = await prepareSend({ context, draft, target, command })
      const accepted = await new Promise<{ sessionId: string }>((resolve, reject) =>
        context.supervisor.send({
          type: 'Send',
          intentId: pendingId,
          input: prepared.input,
          reply: { resolve, reject },
        }),
      )
      return { sessionId: accepted.sessionId, worktreeGone: prepared.worktreeGone }
    }
  }
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
