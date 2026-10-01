import { stat } from 'node:fs/promises'
import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { sessionAttachmentInputSchema } from '@/domains/sessions/api/attachments'
import { pendingSessionId } from '@/domains/sessions/api/pending-session'
import type { SessionSubmitRejection } from '@/domains/sessions/api/session-submit-rejection'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { deleteComposerDraft, draftTurnConfigurationSchema, readComposerDraft } from '../database'
import { type LiveSessionSupervisorActor, SessionSubmitRejectedError } from '../live'
import { offeredFolders, projectFolders, readWorktreeBranch } from '../worktree'

const t = initTRPC.create()
const commandSchema = z.strictObject({
  commandId: identifierSchema,
  prompt: z.string(),
  attachments: z.array(sessionAttachmentInputSchema),
  turnConfiguration: draftTurnConfigurationSchema,
})
// The linked worktree a new Session runs in; null runs it in the Project's main checkout.
const sessionWorktreeSchema = z
  .strictObject({
    path: z.string().min(1),
    branch: z.string().min(1).nullable(),
    owned: z.boolean(),
  })
  .nullable()
const sessionStartInputSchema = commandSchema.extend({
  harness: harnessSchema,
  projectId: identifierSchema,
  worktree: sessionWorktreeSchema,
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
export type SessionProcedureContext = {
  database: Database
  supervisor: LiveSessionSupervisorActor
  createOwnedWorktree: (
    projectId: string,
    draftId: string,
  ) => Promise<{ path: string; branch: string }>
  acceptsAttachments: (harness: Harness) => boolean
}
type DraftRequest = {
  context: SessionProcedureContext
  draft: NonNullable<ReturnType<typeof readComposerDraft>>
  command: ReturnType<typeof commandForDraft>
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

// A Harness given a missing folder fails in its own way, or not at all, so every one stops here.
function folderPresent(folder: string): Promise<boolean> {
  return stat(folder).then(
    (found) => found.isDirectory(),
    () => false,
  )
}

async function rejectMissingFolder(folder: string): Promise<void> {
  if (!(await folderPresent(folder)))
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'folder-missing' satisfies SessionSubmitRejection,
    })
}

function rejected(code: 'BAD_REQUEST' | 'PRECONDITION_FAILED', message: string): TRPCError {
  return new TRPCError({ code, message })
}

type ProjectTarget = Extract<DraftRequest['draft']['target'], { type: 'project' }>

// The folder a new Session runs in, by the draft's choice: a new owned worktree, the main
// checkout, or a linked worktree of the Project.
async function chosenFolder(
  context: SessionProcedureContext,
  target: ProjectTarget,
  draftId: string,
): Promise<Pick<SessionStartInput, 'worktree' | 'cwd'>> {
  if (target.worktree === 'new') {
    const created = await context.createOwnedWorktree(target.projectId, draftId).catch(() => {
      throw rejected(
        'PRECONDITION_FAILED',
        'worktree-create-failed' satisfies SessionSubmitRejection,
      )
    })
    return { worktree: { ...created, owned: true }, cwd: created.path }
  }
  const registered = context.database
    .select({ path: project.path })
    .from(project)
    .where(eq(project.id, target.projectId))
    .get()
  if (registered === undefined) throw rejected('BAD_REQUEST', 'missing-project')
  const folders = await offeredFolders(context.database, registered.path)
  if (target.worktree === 'main') return { worktree: null, cwd: folders.main }
  if (!folders.linked.includes(target.worktree))
    throw rejected('PRECONDITION_FAILED', 'folder-missing' satisfies SessionSubmitRejection)
  const branch = await readWorktreeBranch(target.worktree)
  return { worktree: { path: target.worktree, branch, owned: false }, cwd: target.worktree }
}

async function prepareProjectDraft(input: DraftRequest): Promise<SessionStartInput | null> {
  const { context, draft, command } = input
  if (draft.target.type !== 'project') return null
  const target = draft.target
  rejectUnsupportedAttachments(context, target.harness, draft.attachments)
  const folder = await chosenFolder(context, target, draft.id)
  await rejectMissingFolder(folder.cwd)
  return { ...command, harness: target.harness, projectId: target.projectId, ...folder }
}

// A Session whose worktree folder is gone continues in the Project's main checkout and drops the
// worktree, as Claude Code does. https://code.claude.com/docs/en/worktrees
async function leaveGoneWorktree(
  database: Database,
  stored: { sessionId: string; projectId: string | null; worktreePath: string },
): Promise<string> {
  const registered =
    stored.projectId === null
      ? undefined
      : database
          .select({ path: project.path })
          .from(project)
          .where(eq(project.id, stored.projectId))
          .get()
  if (registered === undefined)
    throw rejected('PRECONDITION_FAILED', 'folder-missing' satisfies SessionSubmitRejection)
  const { main } = await projectFolders(registered.path)
  database
    .update(sessionTable)
    .set({ cwd: main, worktreePath: null, worktreeBranch: null, worktreeOwned: null })
    .where(eq(sessionTable.argoId, stored.sessionId))
    .run()
  return main
}

type PreparedSend = { input: SessionSendInput; worktreeGone: string | null }

async function prepareSessionDraft(input: DraftRequest): Promise<PreparedSend | null> {
  const { context, draft, command } = input
  if (draft.target.type !== 'session') return null
  const stored = context.database
    .select({
      harness: sessionTable.harness,
      nativeId: sessionTable.nativeId,
      projectId: sessionTable.projectId,
      cwd: sessionTable.cwd,
      worktreePath: sessionTable.worktreePath,
    })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, draft.target.sessionId))
    .get()
  if (stored === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  const harness = harnessSchema.parse(stored.harness)
  rejectUnsupportedAttachments(context, harness, draft.attachments)
  const sessionId = draft.target.sessionId
  const worktreeGone =
    stored.worktreePath !== null && !(await folderPresent(stored.worktreePath))
      ? stored.worktreePath
      : null
  const cwd =
    worktreeGone === null
      ? (stored.cwd ?? stored.worktreePath)
      : await leaveGoneWorktree(context.database, {
          ...stored,
          sessionId,
          worktreePath: worktreeGone,
        })
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
  const request = { context, draft, command }
  const startInput = await prepareProjectDraft(request)
  const send = startInput === null ? await prepareSessionDraft(request) : null
  const worktreeGone = send?.worktreeGone ?? null
  const accepted = await new Promise<{ sessionId: string }>((resolve, reject) => {
    const reply = { resolve, reject }
    if (startInput !== null)
      context.supervisor.send({
        type: 'Start',
        pendingId: pendingSessionId(draft),
        input: startInput,
        reply,
      })
    else if (send !== null)
      context.supervisor.send({
        type: 'Send',
        intentId: pendingSessionId(draft),
        input: send.input,
        reply,
      })
  })
  return { sessionId: accepted.sessionId, worktreeGone }
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
