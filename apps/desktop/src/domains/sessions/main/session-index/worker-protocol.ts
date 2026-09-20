import { z } from 'zod'
import { sessionRosterRowSchema } from '@/domains/sessions/contract/models'

const harnessSchema = z.string().min(1)
const identifiersSchema = z.array(z.string().min(1))
const indexedFileSchema = z.strictObject({
  path: z.string().min(1),
  sessionId: z.string().min(1),
  writtenAt: z.number(),
  size: z.number().int().nonnegative(),
  // A file that holds no message belongs to no chain, and says so with an empty id.
  chainId: z.string(),
})
const indexedChainSchema = z.strictObject({
  chainId: z.string().min(1),
  updatedAt: z.string().nullable(),
  row: sessionRosterRowSchema,
  originUnread: z.boolean(),
  searchText: z.string(),
})
const linkSchema = z.strictObject({
  sessionId: z.string().min(1),
  parentSessionId: z.string().nullable(),
})
const indexWriteSchema = z.strictObject({
  files: z.array(indexedFileSchema),
  chains: z.array(indexedChainSchema),
  links: z.array(linkSchema),
  removedPaths: z.array(z.string().min(1)),
  retiredChainIds: z.array(z.string().min(1)),
})
const backfillProgressSchema = z.strictObject({
  boundary: z.strictObject({ writtenAt: z.number(), path: z.string().min(1) }).nullable(),
  complete: z.boolean(),
})

export const SESSION_INDEX_OPERATIONS = [
  'filesAt',
  'filesOfChains',
  'rowsOfChains',
  'searchChains',
  'chainLinks',
  'strandedChains',
  'write',
  'backfillProgress',
  'setBackfillProgress',
] as const

const requestHeader = { id: z.number().int().nonnegative() }
export const sessionIndexWorkerRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    ...requestHeader,
    operation: z.literal('filesAt'),
    args: z.tuple([harnessSchema, identifiersSchema]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('filesOfChains'),
    args: z.tuple([harnessSchema, identifiersSchema]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('rowsOfChains'),
    args: z.tuple([harnessSchema, identifiersSchema]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('searchChains'),
    args: z.tuple([harnessSchema, z.string()]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('chainLinks'),
    args: z.tuple([harnessSchema]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('strandedChains'),
    args: z.tuple([harnessSchema]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('write'),
    args: z.tuple([harnessSchema, indexWriteSchema]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('backfillProgress'),
    args: z.tuple([harnessSchema]),
  }),
  z.strictObject({
    ...requestHeader,
    operation: z.literal('setBackfillProgress'),
    args: z.tuple([harnessSchema, backfillProgressSchema]),
  }),
])
export type SessionIndexWorkerRequest = z.infer<typeof sessionIndexWorkerRequestSchema>

export const sessionIndexWorkerResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ id: z.number().int().nonnegative(), ok: z.literal(true), result: z.unknown() }),
  z.strictObject({
    id: z.number().int().nonnegative(),
    ok: z.literal(false),
    kind: z.enum(['fallback', 'internal']),
    recovery: z.enum(['busy', 'damaged']).nullable(),
    message: z.string(),
  }),
])
export type SessionIndexWorkerResponse = z.infer<typeof sessionIndexWorkerResponseSchema>

export const sessionIndexWorkerDataSchema = z.strictObject({ databasePath: z.string().min(1) })
