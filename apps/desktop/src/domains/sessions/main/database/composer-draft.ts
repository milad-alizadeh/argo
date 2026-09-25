import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { composerDraft } from '@/database/composer-draft/schema'
import { composerDraftSelectSchema } from '@/database/composer-draft/validation'
import type { Database } from '@/database/database'
import { sessionAttachmentInputSchema } from '@/domains/sessions/api/attachments'
import { harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'

export const draftTicketContextSchema = z.strictObject({
  id: z.string().min(1),
  provider: z.enum(['github', 'linear']),
  key: z.string().min(1),
  title: z.string(),
  status: z.string(),
  terminal: z.boolean(),
  blocked: z.boolean().nullable(),
})

export const draftTurnConfigurationSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.string().min(1),
  mode: z.string().min(1),
})

const projectTargetSchema = z.strictObject({
  type: z.literal('project'),
  projectId: identifierSchema,
  workspaceId: identifierSchema,
  harness: harnessSchema,
})
const sessionTargetSchema = z.strictObject({
  type: z.literal('session'),
  sessionId: identifierSchema,
})
export const composerDraftTargetSchema = z.discriminatedUnion('type', [
  projectTargetSchema,
  sessionTargetSchema,
])

export const composerDraftValueSchema = z.strictObject({
  id: identifierSchema,
  target: composerDraftTargetSchema,
  prompt: z.string(),
  attachments: z.array(sessionAttachmentInputSchema),
  ticketContext: z.array(draftTicketContextSchema),
  turnConfiguration: draftTurnConfigurationSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})
export type ComposerDraftValue = z.infer<typeof composerDraftValueSchema>

export const composerDraftContentSchema = composerDraftValueSchema.pick({
  prompt: true,
  attachments: true,
  ticketContext: true,
  turnConfiguration: true,
})
export type ComposerDraftContent = z.infer<typeof composerDraftContentSchema>

function parseJson<Value>(source: string, schema: z.ZodType<Value>): Value {
  return schema.parse(JSON.parse(source))
}

function valueFromRow(stored: unknown): ComposerDraftValue {
  const row = composerDraftSelectSchema.parse(stored)
  const target =
    row.projectId === null
      ? sessionTargetSchema.parse({ type: 'session', sessionId: row.sessionId })
      : projectTargetSchema.parse({
          type: 'project',
          projectId: row.projectId,
          workspaceId: row.workspaceId,
          harness: row.harness,
        })
  return composerDraftValueSchema.parse({
    id: row.id,
    target,
    prompt: row.prompt,
    attachments: parseJson(row.attachmentsJson, z.array(sessionAttachmentInputSchema)),
    ticketContext: parseJson(row.ticketContextJson, z.array(draftTicketContextSchema)),
    turnConfiguration: {
      model: row.model,
      effort: row.effort,
      mode: row.mode,
    },
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

function storedContent(content: ComposerDraftContent) {
  return {
    prompt: content.prompt,
    attachmentsJson: JSON.stringify(content.attachments),
    ticketContextJson: JSON.stringify(content.ticketContext),
    model: content.turnConfiguration.model,
    effort: content.turnConfiguration.effort,
    mode: content.turnConfiguration.mode,
  }
}

function storedTarget(target: ComposerDraftValue['target']) {
  return target.type === 'project'
    ? {
        projectId: target.projectId,
        sessionId: null,
        workspaceId: target.workspaceId,
        harness: target.harness,
      }
    : {
        projectId: null,
        sessionId: target.sessionId,
        workspaceId: null,
        harness: null,
      }
}

export function readComposerDraft(database: Database, id: string): ComposerDraftValue | null {
  const row = database.select().from(composerDraft).where(eq(composerDraft.id, id)).get()
  return row === undefined ? null : valueFromRow(row)
}

export function readComposerDraftForTarget(
  database: Database,
  target: ComposerDraftValue['target'],
): ComposerDraftValue | null {
  const condition =
    target.type === 'project'
      ? eq(composerDraft.projectId, target.projectId)
      : eq(composerDraft.sessionId, target.sessionId)
  const row = database.select().from(composerDraft).where(condition).get()
  return row === undefined ? null : valueFromRow(row)
}

export function insertComposerDraft(
  database: Database,
  input: { id: string; target: ComposerDraftValue['target'] } & ComposerDraftContent,
): ComposerDraftValue {
  database
    .insert(composerDraft)
    .values({ id: input.id, ...storedTarget(input.target), ...storedContent(input) })
    .run()
  const created = readComposerDraft(database, input.id)
  if (created === null) throw new Error('Composer draft did not persist.')
  return created
}

export function updateComposerDraft(
  database: Database,
  input: {
    id: string
    expectedRevision: number
    target: ComposerDraftValue['target']
  } & ComposerDraftContent,
): ComposerDraftValue | null {
  const updated = database
    .update(composerDraft)
    .set({
      ...storedTarget(input.target),
      ...storedContent(input),
      revision: input.expectedRevision + 1,
    })
    .where(and(eq(composerDraft.id, input.id), eq(composerDraft.revision, input.expectedRevision)))
    .returning()
    .get()
  return updated === undefined ? null : valueFromRow(updated)
}

export function deleteComposerDraft(
  database: Database,
  id: string,
  expectedRevision: number,
): boolean {
  return (
    database
      .delete(composerDraft)
      .where(and(eq(composerDraft.id, id), eq(composerDraft.revision, expectedRevision)))
      .returning({ id: composerDraft.id })
      .get() !== undefined
  )
}
