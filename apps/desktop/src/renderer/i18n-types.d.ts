import 'i18next'

import type { CATALOGS, DEFAULT_NAMESPACE } from '@/renderer/catalogs'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE
    resources: typeof CATALOGS
  }
}
