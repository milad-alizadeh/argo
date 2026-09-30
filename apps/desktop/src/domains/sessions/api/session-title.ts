import { z } from 'zod'

// Strongest first: the Session list uses this order for persisted and live projections.
const SESSION_TITLE_SOURCES = ['custom', 'ticket', 'summarised', 'first-prompt'] as const
const sessionTitleSourceSchema = z.enum(SESSION_TITLE_SOURCES)
export const sessionTitleSchema = z.strictObject({
  text: z.string(),
  source: sessionTitleSourceSchema,
})
