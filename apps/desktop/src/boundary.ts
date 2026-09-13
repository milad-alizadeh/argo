// The predicates every contract in this app parses its outside data with. They live here rather
// than in one domain's contract because two now share them, and a copy would be a second place
// for "what counts as an identifier" to drift.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isIdentifier(value: unknown): value is string {
  return identifierSchema.safeParse(value).success
}

export function requestIdentifier(value: unknown): string | null {
  return isRecord(value) && isIdentifier(value.requestId) ? value.requestId : null
}

export function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

import { z } from 'zod'

export const identifierSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !/[\s\p{Cc}]/u.test(value))
