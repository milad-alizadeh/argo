import 'i18next'

import type { CATALOGS, DEFAULT_NAMESPACE } from '@/platform/renderer/i18n/catalogs'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE
    resources: typeof CATALOGS
  }
}
