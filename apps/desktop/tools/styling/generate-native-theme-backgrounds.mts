import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { compile } from 'tailwindcss'
import { THEMES } from '../../src/platform/contract/appearance.ts'

const directory = path.resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)
const palette = await readFile(require.resolve('tailwindcss/theme.css'), 'utf8')
const themes = await Promise.all(
  THEMES.map((theme) =>
    readFile(path.join(directory, 'src/platform/renderer/styles/themes', `${theme}.css`), 'utf8'),
  ),
)
const compiler = await compile([palette, ...themes].join('\n'))
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent('<!doctype html><html><body></body></html>')
  await page.addStyleTag({ content: compiler.build([]) })
  const backgrounds = {} as Record<string, { light: string; dark: string }>
  for (const theme of THEMES) {
    backgrounds[theme] = { light: '', dark: '' }
    for (const appearance of ['light', 'dark'] as const) {
      backgrounds[theme][appearance] = await page.evaluate(
        ({ theme, appearance }) => {
          const root = document.documentElement
          root.dataset.theme = theme
          root.classList.toggle('dark', appearance === 'dark')
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          const context = canvas.getContext('2d', { willReadFrequently: true })
          if (!context) throw new Error('Color conversion needs a canvas.')
          const color = getComputedStyle(root).getPropertyValue('--background').trim()
          if (!CSS.supports('color', color)) throw new Error(`Invalid background: ${color}`)
          context.fillStyle = color
          context.fillRect(0, 0, 1, 1)
          const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
          if (channels[3] !== 255) throw new Error('Native backgrounds must be opaque.')
          return `#${channels
            .slice(0, 3)
            .map((channel) => channel.toString(16).padStart(2, '0'))
            .join('')}`
        },
        { theme, appearance },
      )
    }
  }
  const target = path.join(directory, 'src/platform/contract/native-theme-backgrounds.json')
  const source = `${JSON.stringify(backgrounds, null, 2)}\n`
  if (process.argv.includes('--check')) {
    if ((await readFile(target, 'utf8')) !== source)
      throw new Error('Native theme backgrounds are stale.')
  } else {
    await writeFile(target, source)
  }
} finally {
  await browser.close()
}
