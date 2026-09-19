// The strings the operating system draws: the application menu and the native file dialogs. No
// renderer draws them, so the main process translates them itself rather than sending a code the
// way every other message does (#2130). The renderer registers this same file as its `platform`
// namespace, so a shortcut the menu names and a renderer surface names later is one word from one
// place. Every key here is spelled as i18next spells one, which is why none of the leaves is dotted.
import { FALLBACK_LANGUAGE, PLATFORM_ENGLISH, type PlatformKey } from '@/platform/shared/i18n'

function flatten(catalog: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(catalog).flatMap(([segment, value]) => {
      const key = prefix ? `${prefix}.${segment}` : segment
      return typeof value === 'string' ? [[key, value]] : Object.entries(flatten(value, key))
    }),
  )
}

const CATALOGS: Record<string, Record<string, string>> = { en: flatten(PLATFORM_ENGLISH) }

let language = FALLBACK_LANGUAGE

// Electron hands back a tag such as `en-GB`, and a catalog is named by its base language.
export function setPlatformLanguage(chosen: string): void {
  language = chosen.split('-')[0] ?? FALLBACK_LANGUAGE
}

export function platformText(key: PlatformKey): string {
  const text = CATALOGS[language]?.[key] ?? CATALOGS[FALLBACK_LANGUAGE]?.[key]
  if (text === undefined) throw new Error(`No platform text is declared for ${key}`)
  return text
}
