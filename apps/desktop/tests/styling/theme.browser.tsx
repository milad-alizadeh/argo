import { afterEach, describe, expect, test } from 'vitest'
import { THEMES } from '@/platform/contract/appearance'
import nativeThemeBackgrounds from '@/platform/contract/native-theme-backgrounds.json'
import { drawnColor, mountSpecimen, resetAppearanceDocument } from './browser-fixture'

let cleanup = () => {}
afterEach(() => {
  cleanup()
  cleanup = () => {}
  resetAppearanceDocument()
})

describe.each(THEMES)('%s theme', (theme) => {
  test.each(['light', 'dark'] as const)('%s native background matches actual CSS', (appearance) => {
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const style = getComputedStyle(document.documentElement)
    const expected = drawnColor(nativeThemeBackgrounds[theme][appearance])
    expect(drawnColor(style.getPropertyValue('--background'))).toEqual(expected)
    expect(expected[3]).toBe(255)
    const mounted = mountSpecimen(<div className="bg-background text-foreground">Theme sample</div>)
    cleanup = mounted.cleanup
    const sample = mounted.container.firstElementChild
    if (!sample) throw new Error('Missing theme sample')
    expect(drawnColor(getComputedStyle(sample).backgroundColor)).toEqual(expected)
  })
})
