import { z } from 'zod'

const claudeModelSchema = z.strictObject({
  value: z.string().min(1),
  resolvedModel: z.string().min(1).optional(),
  displayName: z.string().min(1),
  description: z.string(),
  supportedEffortLevels: z.array(z.string().min(1)),
})

export const claudeModelCatalogSchema = z.strictObject({
  data: z.array(claudeModelSchema),
  supportedPermissionModes: z.array(z.string().min(1)),
})
export type ClaudeModelCatalog = z.infer<typeof claudeModelCatalogSchema>

export function claudeModelsWithEffort(catalog: ClaudeModelCatalog | null) {
  return catalog?.data.filter(({ supportedEffortLevels }) => supportedEffortLevels.length > 0) ?? []
}

export function claudePermissionModes(catalog: ClaudeModelCatalog | null) {
  return catalog?.supportedPermissionModes ?? []
}
