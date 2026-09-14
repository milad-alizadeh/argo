// The strings the operating system draws: the application menu and the native file dialogs. No
// renderer draws them, so the main process translates them itself rather than sending a code the
// way every other message does (#2130). The renderer reads the same catalog as its `platform`
// namespace, so a shortcut named in the menu and again on screen is one word from one place.
import en from './locales/en.json'

export type PlatformCatalog = typeof en

// A dotted key reaching a leaf. The shortcut keys hold dots of their own, which is why the catalog
// is flattened into one map instead of walked segment by segment.
type LeafKeys<Catalog> = Catalog extends string
  ? ''
  : {
      [Segment in keyof Catalog & string]: LeafKeys<Catalog[Segment]> extends infer Rest extends
        string
        ? Rest extends ''
          ? Segment
          : `${Segment}.${Rest}`
        : never
    }[keyof Catalog & string]

export type PlatformKey = LeafKeys<PlatformCatalog>
export type ShortcutLabelKey = Extract<PlatformKey, `shortcut.${string}`>

function flatten(catalog: object, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(catalog).flatMap(([segment, value]) => {
      const key = prefix ? `${prefix}.${segment}` : segment
      return typeof value === 'string' ? [[key, value]] : Object.entries(flatten(value, key))
    }),
  )
}

const CATALOGS: Record<string, Record<string, string>> = { en: flatten(en) }

export const FALLBACK_LANGUAGE = 'en'

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
