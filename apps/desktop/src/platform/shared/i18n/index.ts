import en from '@/platform/shared/i18n/locales/en.json'

export type PlatformCatalog = typeof en

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

export const FALLBACK_LANGUAGE = 'en'
export const PLATFORM_ENGLISH = en
