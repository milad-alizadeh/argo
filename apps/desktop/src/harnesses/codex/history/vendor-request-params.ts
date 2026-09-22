import { z } from 'zod'
import type { RequestParams } from '../drive/protocol/protocol'

const cursorSchema = z.object({ cursor: z.string().optional(), limit: z.number().int().positive() })

export function listParams(value: unknown): RequestParams['thread/list'] {
  return cursorSchema.parse(value)
}

export function readParams(value: unknown): RequestParams['thread/read'] {
  return z.object({ threadId: z.string().min(1), includeTurns: z.boolean() }).parse(value)
}

export function turnsParams(value: unknown): RequestParams['thread/turns/list'] {
  return z
    .object({
      threadId: z.string().min(1),
      cursor: z.string().optional(),
      limit: z.number().int().positive(),
      itemsView: z.literal('full'),
      sortDirection: z.literal('asc'),
    })
    .parse(value)
}

export function loadedParams(value: unknown): RequestParams['thread/loaded/list'] {
  return z
    .object({ cursor: z.string().optional(), limit: z.number().int().positive() })
    .parse(value)
}
