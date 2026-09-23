import type { ClaudeModelCatalog } from '@/domains/sessions/contract/claude-model-catalog'

export function claudeModelCatalogFixture(): ClaudeModelCatalog {
  return {
    data: [
      {
        value: 'sonnet-live',
        displayName: 'Sonnet Live',
        description: 'Live catalog model',
        supportedEffortLevels: ['low', 'high'],
      },
    ],
  }
}
