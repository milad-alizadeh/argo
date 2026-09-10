import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import sessions from '../modules/sessions/locales/en.json'

void i18n.use(initReactI18next).init({
  defaultNS: 'sessions',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  lng: 'en',
  resources: { en: { sessions } },
})

export { i18n }
