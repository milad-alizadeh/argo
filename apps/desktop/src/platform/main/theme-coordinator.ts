import {
  type Appearance,
  type AppearanceMutation,
  type AppearancePreference,
  type AppearanceState,
  appearanceDocumentSchema,
  appearancePreferenceSchema,
  appearanceSchema,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
} from '@/platform/contract/appearance'
import { isRecord } from '@/shared/validation'
import {
  createWriteQueue,
  otherFields,
  portablePath,
  readDocument,
  writeDocument,
} from './storage/portable-file'

type NativeAppearance = {
  themeSource: Appearance
  readonly shouldUseDarkColors: boolean
  on: (event: 'updated', listener: () => void) => unknown
  off: (event: 'updated', listener: () => void) => unknown
}

async function readPreference(documentPath: string, report: (value: unknown) => void) {
  let preference: AppearancePreference = { theme: DEFAULT_THEME, appearance: DEFAULT_APPEARANCE }
  const loaded = await readDocument(documentPath)
  if (loaded.ok) {
    const parsed = appearanceDocumentSchema.safeParse(loaded.document)
    if (parsed.success)
      preference = { theme: parsed.data.theme, appearance: parsed.data.appearance }
    else {
      report(parsed.error)
      const appearance = appearanceSchema.safeParse(
        isRecord(loaded.document) ? loaded.document.appearance : undefined,
      )
      if (appearance.success) preference.appearance = appearance.data
    }
  } else if (loaded.reason !== 'missing') report(loaded.reason)
  return preference
}

export async function createThemeCoordinator(userData: string, native: NativeAppearance) {
  const documentPath = portablePath(userData, 'appearance.json')
  let rejectedCount = 0
  const report = (value: unknown) => {
    rejectedCount += 1
    console.error(`Rejected appearance value #${rejectedCount}:`, value)
  }
  let preference = await readPreference(documentPath, report)
  native.themeSource = preference.appearance
  let current: AppearanceState = { ...preference, dark: native.shouldUseDarkColors, revision: 0 }
  const listeners = new Set<(state: AppearanceState) => void>()
  const publish = () => {
    current = { ...preference, dark: native.shouldUseDarkColors, revision: current.revision + 1 }
    for (const listener of listeners) listener(current)
  }
  let applying = false
  const updated = () => {
    if (!applying && current.dark !== native.shouldUseDarkColors) publish()
  }
  native.on('updated', updated)
  const enqueue = createWriteQueue()

  return {
    read: () => current,
    subscribe(listener: (state: AppearanceState) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    mutate(value: unknown): Promise<AppearanceMutation> {
      return enqueue(async () => {
        const parsed = appearancePreferenceSchema.safeParse(value)
        if (!parsed.success) {
          report(parsed.error)
          return { ok: false, reason: 'invalid', state: current }
        }
        const previous = await readDocument(documentPath)
        if (!previous.ok && previous.reason === 'unreadable') {
          return { ok: false, reason: 'storage', state: current }
        }
        const document = {
          ...otherFields(previous.ok ? previous.document : undefined, ['appearance', 'theme']),
          ...parsed.data,
        }
        if (!(await writeDocument(documentPath, document))) {
          return { ok: false, reason: 'storage', state: current }
        }
        preference = parsed.data
        applying = true
        try {
          native.themeSource = preference.appearance
        } finally {
          applying = false
        }
        publish()
        return { ok: true, state: current }
      })
    },
    dispose() {
      native.off('updated', updated)
      listeners.clear()
    },
  }
}

export type ThemeCoordinator = Awaited<ReturnType<typeof createThemeCoordinator>>
