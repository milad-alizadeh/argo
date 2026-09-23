import { z } from 'zod'

export const codexModelCatalogSchema = z.strictObject({
  data: z.array(
    z.strictObject({
      id: z.string().min(1),
      model: z.string().min(1),
      displayName: z.string(),
      description: z.string(),
      defaultReasoningEffort: z.string().min(1),
      isDefault: z.boolean(),
      hidden: z.boolean(),
      supportedReasoningEfforts: z.array(
        z.strictObject({ reasoningEffort: z.string().min(1), description: z.string() }),
      ),
    }),
  ),
  nextCursor: z.string().nullable(),
})
export type CodexModelCatalog = z.infer<typeof codexModelCatalogSchema>
