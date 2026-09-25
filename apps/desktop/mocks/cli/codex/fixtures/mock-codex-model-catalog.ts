import type { CodexModelCatalog } from '@/harnesses/codex/catalog'

export const MOCK_CODEX_MODEL_CATALOG: CodexModelCatalog = {
  data: [
    {
      id: 'mock-haiku',
      model: 'mock-haiku',
      displayName: 'Mock Haiku',
      description: 'Fast mock model with two reasoning efforts.',
      defaultReasoningEffort: 'low',
      isDefault: true,
      hidden: false,
      supportedReasoningEfforts: [
        { reasoningEffort: 'low', description: 'Low' },
        { reasoningEffort: 'high', description: 'High' },
      ],
    },
    {
      id: 'mock-opus',
      model: 'mock-opus',
      displayName: 'Mock Opus',
      description: 'Mock model with three reasoning efforts.',
      defaultReasoningEffort: 'high',
      isDefault: false,
      hidden: false,
      supportedReasoningEfforts: [
        { reasoningEffort: 'medium', description: 'Medium' },
        { reasoningEffort: 'high', description: 'High' },
        { reasoningEffort: 'xhigh', description: 'Extra high' },
      ],
    },
    {
      id: 'mock-hidden',
      model: 'mock-hidden',
      displayName: 'Hidden mock model',
      description: 'Not available to users.',
      defaultReasoningEffort: 'low',
      isDefault: false,
      hidden: true,
      supportedReasoningEfforts: [{ reasoningEffort: 'low', description: 'Low' }],
    },
  ],
  nextCursor: null,
}
