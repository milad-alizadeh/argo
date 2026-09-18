import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { FALLBACK_LANGUAGE } from '../../shared/i18n'
import { CATALOGS, DEFAULT_NAMESPACE } from './catalogs'

// English is the only language this build ships, so the reader's language settles the plural rules
// and nothing else until a second catalog lands (#2130). A test proves a second one is drawn.
void i18n.use(initReactI18next).init({
  defaultNS: DEFAULT_NAMESPACE,
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
  lng: navigator.language,
  ns: Object.keys(CATALOGS),
  // `init` resolves a tick late, and until it does `useTranslation` suspends, which reads in a
  // test as a component suspending inside an unawaited `act`. Every resource is bundled here, so
  // there is nothing to wait for.
  react: { useSuspense: false },
  resources: { [FALLBACK_LANGUAGE]: CATALOGS },
})

export { i18n }
