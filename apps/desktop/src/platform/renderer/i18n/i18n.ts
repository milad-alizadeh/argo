import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { FALLBACK_LANGUAGE } from '@/platform/shared/i18n'

type Catalogs = Record<string, object>

export function initializeRendererI18n({
  catalogs,
  defaultNamespace,
  language,
}: {
  catalogs: Catalogs
  defaultNamespace: string
  language: string
}) {
  return i18n.use(initReactI18next).init({
    defaultNS: defaultNamespace,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: { escapeValue: false },
    lng: language,
    ns: Object.keys(catalogs),
    // Every resource is bundled, so a component never needs to suspend while initialization settles.
    react: { useSuspense: false },
    resources: { [FALLBACK_LANGUAGE]: catalogs },
  })
}

export { i18n }
