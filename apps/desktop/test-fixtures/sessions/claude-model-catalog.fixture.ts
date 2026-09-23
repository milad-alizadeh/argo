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
    supportedPermissionModes: [
      'manual',
      'acceptEdits',
      'plan',
      'auto',
      'dontAsk',
      'bypassPermissions',
    ],
  }
}

export function claudeComposerModelCatalogFixture(): ClaudeModelCatalog {
  return {
    data: ['opus', 'sonnet'].map((value) => ({
      value,
      resolvedModel: `claude-${value}-5`,
      displayName: value === 'opus' ? 'Opus 5' : 'Sonnet 5',
      description: `${value} catalog model`,
      supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    })),
    supportedPermissionModes: [
      'manual',
      'acceptEdits',
      'plan',
      'auto',
      'dontAsk',
      'bypassPermissions',
    ],
  }
}
