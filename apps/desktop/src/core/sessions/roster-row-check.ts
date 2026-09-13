// One Roster row's schema at the renderer's edge, beside `replies.ts`, which reads the reply the
// rows travel in.
import { z } from 'zod'
import { identifier } from '../contract/messages'
import {
  SESSION_ENTRIES,
  SESSION_POSTURES,
  SESSION_STATUSES,
  type SessionRosterRow,
  TITLE_SOURCES,
} from './models'

// The closed sets are the domain's own, imported rather than copied: a check against a second
// list would pass a value the type refuses, or refuse one it allows, and nothing would say which.
const count = z.int().min(0)
const optionalText = z.string().nullable()

export const rosterRow: z.ZodType<SessionRosterRow> = z.strictObject({
  id: identifier,
  retiredIds: z.array(z.string()),
  cli: identifier,
  posture: z.enum(SESSION_POSTURES),
  title: z.strictObject({ text: z.string(), source: z.enum(TITLE_SOURCES) }).nullable(),
  status: z.enum(SESSION_STATUSES),
  entry: z.enum(SESSION_ENTRIES),
  cwd: optionalText,
  branch: optionalText,
  updatedAt: optionalText,
  unreadableLines: z.number(),
  originUnread: z.boolean(),
  archived: z.boolean(),
  // The facts the row's lines and its marker column are drawn from, beyond the row's identity.
  turnStartedAt: optionalText,
  activity: z.strictObject({ tool: z.string(), target: optionalText }).nullable(),
  plan: z.strictObject({ total: count, completed: count, inProgress: count }).nullable(),
  delegations: z.array(
    z.strictObject({ id: z.string(), label: optionalText, landed: z.boolean() }),
  ),
  shell: z.array(
    z.strictObject({ id: z.string(), command: optionalText, background: z.boolean() }),
  ),
  pullRequest: z
    .strictObject({ number: count, url: z.string(), repository: optionalText })
    .nullable(),
})
