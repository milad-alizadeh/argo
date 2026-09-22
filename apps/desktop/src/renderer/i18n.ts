import { i18n, initializeRendererI18n } from '@/platform/renderer/i18n/i18n'
import { CATALOGS, DEFAULT_NAMESPACE } from './catalogs'

// English is the only language this build ships, so the reader's language settles the plural rules
// and nothing else until a second catalog lands (#2130). A test proves a second one is drawn.
void initializeRendererI18n({
  catalogs: CATALOGS,
  defaultNamespace: DEFAULT_NAMESPACE,
  language: navigator.language,
})

export { i18n }
