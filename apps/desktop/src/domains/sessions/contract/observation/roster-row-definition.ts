import { z } from 'zod'
import {
  type SessionRosterRow,
  type SessionTitle,
  sessionRosterRowSchema,
} from '../model'
import type { RosterRowContext } from './roster-row-context'
import { type RosterRowField, rosterRowFields } from './roster-row-fields'

export { rosterRowFields } from './roster-row-fields'

type RosterRowShape = {
  [Field in (typeof rosterRowFields)[number] as Field['name']]: ReturnType<Field['schema']>
}

export function createSessionRosterRowSchema(): z.ZodObject<RosterRowShape> {
  return z.strictObject(
    Object.fromEntries(rosterRowFields.map(({ name, schema }) => [name, schema()])),
  ) as z.ZodObject<RosterRowShape>
}

export type ManagedRosterSeed = {
  id: string
  session: Omit<
    Pick<
      SessionRosterRow,
      | 'harness'
      | 'compactionPercentage'
      | 'compactionStartedAt'
      | 'compactionTokens'
      | 'handoffFailure'
      | 'handoffStartedAt'
      | 'cwd'
      | 'plan'
      | 'status'
      | 'setup'
    >,
    'plan'
  > & {
    prompt: string
    startedAt: string
    title?: SessionTitle
    plan?: SessionRosterRow['plan']
  }
}

function managedValue(field: RosterRowField, seed: ManagedRosterSeed): unknown {
  return managedValues[field.managed](field, seed)
}

const managedValues: Record<
  RosterRowField['managed'],
  (field: RosterRowField, seed: ManagedRosterSeed) => unknown
> = {
  id: (_, seed) => seed.id,
  session: (field, seed) => seed.session[field.name as keyof typeof seed.session] ?? null,
  managed: () => 'managed',
  title: (_, seed) => seed.session.title ?? { text: seed.session.prompt, source: 'first-prompt' },
  interactive: () => 'interactive',
  'started-at': (_, seed) => seed.session.startedAt,
  empty: () => [],
  zero: () => 0,
  null: () => null,
  false: () => false,
  absent: () => undefined,
}

export function managedRosterRow(seed: ManagedRosterSeed): SessionRosterRow {
  return sessionRosterRowSchema.parse(
    Object.fromEntries(rosterRowFields.map((field) => [field.name, managedValue(field, seed)])),
  )
}

export function observedRosterRow(context: RosterRowContext): SessionRosterRow {
  return sessionRosterRowSchema.parse(
    Object.fromEntries(rosterRowFields.map((field) => [field.name, field.read(context)])),
  )
}

export function reconcileRosterRow(
  observed: SessionRosterRow,
  held: SessionRosterRow,
  strongerTitle: () => SessionTitle | null,
): SessionRosterRow {
  return sessionRosterRowSchema.parse(
    Object.fromEntries(
      rosterRowFields.map((field) => [
        field.name,
        reconciledValue(field, { observed, held, strongerTitle }),
      ]),
    ),
  )
}

function reconciledValue(
  field: RosterRowField,
  rows: {
    observed: SessionRosterRow
    held: SessionRosterRow
    strongerTitle: () => SessionTitle | null
  },
): unknown {
  return reconciliationValues[field.reconciliation](field, rows)
}

const reconciliationValues: Record<
  RosterRowField['reconciliation'],
  (
    field: RosterRowField,
    rows: {
      observed: SessionRosterRow
      held: SessionRosterRow
      strongerTitle: () => SessionTitle | null
    },
  ) => unknown
> = {
  held: (field, rows) => rows.held[field.name as keyof SessionRosterRow],
  'held-when-present': (field, rows) =>
    rows.held[field.name as keyof SessionRosterRow] ??
    rows.observed[field.name as keyof SessionRosterRow],
  observed: (field, rows) => rows.observed[field.name as keyof SessionRosterRow],
  'stronger-title': (_, rows) => rows.strongerTitle(),
}
