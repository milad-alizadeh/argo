import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import sessions from '../modules/sessions/locales/en.json'

void i18n.use(initReactI18next).init({
  defaultNS: 'sessions',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  lng: 'en',
  // `init` resolves a tick late, and until it does `useTranslation` suspends, which reads in a
  // test as a component suspending inside an unawaited `act`. Every resource is bundled here, so
  // there is nothing to wait for.
  react: { useSuspense: false },
  resources: { en: { sessions } },
})

export { i18n }
