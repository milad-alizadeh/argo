import 'i18next'

import type sessions from '../modules/sessions/locales/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'sessions'
    resources: { sessions: typeof sessions }
  }
}
