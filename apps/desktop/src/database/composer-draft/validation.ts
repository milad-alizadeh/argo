import { createSelectSchema } from 'drizzle-orm/zod'
import { composerDraft } from './schema'

export const composerDraftSelectSchema = createSelectSchema(composerDraft).strict()
