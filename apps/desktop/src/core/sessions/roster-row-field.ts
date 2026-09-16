import type { z } from 'zod'
import type { RosterRowContext } from './roster-row-context'

export type Reconciliation = 'held' | 'observed' | 'stronger-title'
export type ManagedRule =
  | 'id'
  | 'session'
  | 'managed'
  | 'title'
  | 'interactive'
  | 'started-at'
  | 'empty'
  | 'zero'
  | 'null'
  | 'false'
  | 'absent'
export type RosterRowField<Name extends string = string, Schema extends z.ZodType = z.ZodType> = {
  name: Name
  schema: () => Schema
  read: (context: RosterRowContext) => unknown
  managed: ManagedRule
  reconciliation: Reconciliation
}
type FieldInput<Name extends string, Schema extends z.ZodType> = readonly [
  Name,
  () => Schema,
  (context: RosterRowContext) => unknown,
  ManagedRule,
  Reconciliation,
]

export function rosterRowField<Name extends string, Schema extends z.ZodType>([
  name,
  schema,
  read,
  managed,
  reconciliation,
]: FieldInput<Name, Schema>): RosterRowField<Name, Schema> {
  return { name, schema, read, managed, reconciliation }
}
