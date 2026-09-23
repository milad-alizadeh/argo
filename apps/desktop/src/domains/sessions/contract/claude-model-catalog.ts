import { z } from 'zod'

export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

const claudeModelSchema = z.strictObject({
  value: z.string().min(1),
  resolvedModel: z.string().min(1).optional(),
  displayName: z.string().min(1),
  description: z.string(),
  supportedEffortLevels: z.array(z.enum(CLAUDE_EFFORTS)),
})

export const claudeModelCatalogSchema = z.strictObject({
  data: z.array(claudeModelSchema),
})
export type ClaudeModelCatalog = z.infer<typeof claudeModelCatalogSchema>

export function claudeModelsWithEffort(catalog: ClaudeModelCatalog | null) {
  return catalog?.data.filter(({ supportedEffortLevels }) => supportedEffortLevels.length > 0) ?? []
}
