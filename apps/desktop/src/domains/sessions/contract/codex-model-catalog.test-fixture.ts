import type { CodexModelCatalog } from './codex-model-catalog'

export function codexModelCatalogFixture(): CodexModelCatalog {
  return {
    data: [
      {
        id: 'gpt-live',
        model: 'gpt-live',
        displayName: 'Live model',
        description: 'Advertised by app-server',
        defaultReasoningEffort: 'focused',
        isDefault: true,
        hidden: false,
        supportedReasoningEfforts: [{ reasoningEffort: 'focused', description: 'Focused' }],
      },
    ],
    nextCursor: null,
  }
}
