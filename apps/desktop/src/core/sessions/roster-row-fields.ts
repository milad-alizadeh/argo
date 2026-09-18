import { z } from 'zod'
import { identifierSchema } from '../../shared/validation'
import {
  sessionActivitySchema,
  sessionDelegationSchema,
  sessionEntrySchema,
  sessionPlanSchema,
  sessionPostureSchema,
  sessionPullRequestSchema,
  sessionSetupSchema,
  sessionShellCommandSchema,
  sessionStatusSchema,
  sessionTicketSchema,
  sessionTitleSchema,
} from './models'
import { rosterRowField as field } from './roster-row-field'

export type { RosterRowField } from './roster-row-field'

const optionalCount = () => z.number().int().nonnegative().nullable().optional()
const optionalDate = () => z.string().datetime().nullable().optional()
const optionalPercentage = () => z.number().int().min(0).max(100).nullable().optional()
const optionalString = () => z.string().nullable().optional()
const optionalIdentifier = () => identifierSchema.nullable().optional()

export const rosterRowFields = [
  field(['id', () => identifierSchema, ({ chain }) => chain.id, 'id', 'observed']),
  field([
    'retiredIds',
    () => z.array(identifierSchema),
    ({ chain }) => chain.retiredIds,
    'empty',
    'observed',
  ]),
  field(['cli', () => identifierSchema, ({ cli }) => cli, 'session', 'observed']),
  field(['posture', () => sessionPostureSchema, () => 'external', 'managed', 'held']),
  field([
    'title',
    () => sessionTitleSchema.nullable(),
    ({ title }) => title,
    'title',
    'stronger-title',
  ]),
  field(['status', () => sessionStatusSchema, ({ status }) => status, 'session', 'observed']),
  field(['entry', () => sessionEntrySchema, ({ entry }) => entry, 'interactive', 'observed']),
  field(['cwd', () => z.string().nullable(), ({ place }) => place.cwd, 'session', 'observed']),
  field(['branch', () => z.string().nullable(), ({ place }) => place.branch, 'null', 'observed']),
  field(['locked', () => z.boolean().optional(), () => undefined, 'absent', 'observed']),
  field([
    'updatedAt',
    () => z.string().nullable(),
    ({ updatedAt }) => updatedAt,
    'started-at',
    'observed',
  ]),
  field([
    'unreadableLines',
    () => z.number(),
    ({ chain }) => chain.files.reduce((total, file) => total + file.unreadableLines, 0),
    'zero',
    'observed',
  ]),
  field([
    'originUnread',
    () => z.boolean(),
    ({ chain }) => chain.originUnread,
    'false',
    'observed',
  ]),
  field([
    'turnStartedAt',
    () => z.string().nullable(),
    ({ turnStartedAt }) => turnStartedAt,
    'null',
    'observed',
  ]),
  field([
    'activity',
    () => sessionActivitySchema.nullable(),
    ({ activity }) => activity,
    'null',
    'observed',
  ]),
  field([
    'plan',
    () => sessionPlanSchema.nullable(),
    ({ plan }) => plan,
    'session',
    'held-when-present',
  ]),
  field([
    'delegations',
    () => z.array(sessionDelegationSchema),
    ({ delegations }) => delegations,
    'empty',
    'observed',
  ]),
  field([
    'shell',
    () => z.array(sessionShellCommandSchema),
    ({ shell }) => shell,
    'empty',
    'observed',
  ]),
  field([
    'pullRequest',
    () => sessionPullRequestSchema.nullable(),
    ({ pullRequest }) => pullRequest,
    'null',
    'observed',
  ]),
  field(['ticket', () => sessionTicketSchema.nullable(), () => null, 'null', 'observed']),
  // Argo's own flag, joined on the Session's id and every id it has retired (`archive-store.ts`).
  field(['archived', () => z.boolean(), () => false, 'false', 'observed']),
  // Search adds one reader-visible excerpt to matching rows; normal roster reads omit it.
  field(['searchExcerpt', optionalString, () => undefined, 'absent', 'observed']),
  field(['contextTokens', optionalCount, ({ usage }) => usage.contextTokens, 'null', 'observed']),
  field([
    'contextWindowTokens',
    optionalCount,
    ({ contextWindowTokens }) => contextWindowTokens,
    'null',
    'observed',
  ]),
  field(['spentTokens', optionalCount, ({ usage }) => usage.spentTokens, 'null', 'observed']),
  field(['compactionStartedAt', optionalDate, () => undefined, 'session', 'held']),
  field(['compactionPercentage', optionalPercentage, () => undefined, 'session', 'held']),
  field(['compactionTokens', optionalString, () => undefined, 'session', 'held']),
  field(['handoffStartedAt', optionalDate, () => undefined, 'session', 'held']),
  field(['handoffFailure', optionalString, () => undefined, 'session', 'held']),
  field(['handoffTo', optionalIdentifier, () => undefined, 'null', 'observed']),
  field(['handoffFrom', optionalIdentifier, () => undefined, 'null', 'observed']),
  field(['setup', () => sessionSetupSchema, ({ setup }) => setup, 'session', 'observed']),
] as const
