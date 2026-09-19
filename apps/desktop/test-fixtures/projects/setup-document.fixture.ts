export const SETUP_DOCUMENT_REVISION = '2026-09-18.1'

export function setupDocumentFixture<
  Overrides extends Record<string, unknown> = Record<never, never>,
>(overrides?: Overrides) {
  return {
    version: 1,
    revision: SETUP_DOCUMENT_REVISION,
    requiredCapabilities: ['fields', 'recommendations', 'plan'],
    locales: {
      en: {
        title: 'Set up this Project',
        description: 'Review the recommended plan before Argo applies it.',
        fields: {},
        plan: {},
      },
    },
    fields: [],
    configuration: { version: 1, targets: {} },
    plan: [],
    ...overrides,
  }
}
