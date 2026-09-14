import 'i18next'

import type { CATALOGS, DEFAULT_NAMESPACE } from './catalogs'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE
    resources: typeof CATALOGS
  }
}
