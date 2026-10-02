import { expect, test } from 'bun:test'
import postcss from 'postcss'

const themeIds = ['catppuccin', 'ocean-breeze', 'northern-lights'] as const
const themeSources = await Promise.all(
  themeIds.map((theme) => Bun.file(new URL(`./themes/${theme}.css`, import.meta.url)).text()),
)
const defaultSource = await Bun.file(new URL('./themes/default.css', import.meta.url)).text()

type Rgb = readonly [number, number, number]

function toRgb(lightness: number, chroma: number, hue: number): Rgb {
  const radians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(radians)
  const b = chroma * Math.sin(radians)
  const l = lightness + 0.3963377774 * a + 0.2158037573 * b
  const m = lightness - 0.1055613458 * a - 0.0638541728 * b
  const s = lightness - 0.0894841775 * a - 1.291485548 * b
  const [linearL, linearM, linearS] = [l ** 3, m ** 3, s ** 3]
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel))
  return [
    clamp(4.0767416621 * linearL - 3.3077115913 * linearM + 0.2309699292 * linearS),
    clamp(-1.2684380046 * linearL + 2.6097574011 * linearM - 0.3413193965 * linearS),
    clamp(-0.0041960863 * linearL - 0.7034186147 * linearM + 1.707614701 * linearS),
  ]
}

function parseOklch(value: string): Rgb {
  const match = value.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/)
  if (!match) throw new Error(`Expected explicit OKLCH color, got ${value}`)
  const [lightness, chroma, hue] = match.slice(1).map(Number)
  if (lightness === undefined || chroma === undefined || hue === undefined) {
    throw new Error(`Expected explicit OKLCH color, got ${value}`)
  }
  return toRgb(lightness, chroma, hue)
}

function luminance(rgb: Rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function contrast(first: Rgb, second: Rgb) {
  const high = Math.max(luminance(first), luminance(second))
  const low = Math.min(luminance(first), luminance(second))
  return (high + 0.05) / (low + 0.05)
}

function declarations(css: string) {
  return postcss
    .parse(css)
    .nodes.filter((node) => node.type === 'rule')
    .map((node) => {
      const values = new Map<string, string>()
      node.walkDecls((declaration) => values.set(declaration.prop, declaration.value))
      return values
    })
}

const textPairs = [
  ['--background', '--foreground'],
  ['--card', '--card-foreground'],
  ['--popover', '--popover-foreground'],
  ['--primary', '--primary-foreground'],
  ['--secondary', '--secondary-foreground'],
  ['--muted', '--muted-foreground'],
  ['--accent', '--accent-foreground'],
  ['--sidebar', '--sidebar-foreground'],
  ['--sidebar-primary', '--sidebar-primary-foreground'],
  ['--sidebar-accent', '--sidebar-accent-foreground'],
] as const

const statusRoles = [
  '--status-success',
  '--status-warning',
  '--status-danger',
  '--status-neutral',
] as const

function requiredColor(values: Map<string, string>, role: string) {
  const value = values.get(role)
  if (!value) throw new Error(`Missing theme color ${role}`)
  return parseOklch(value)
}

function expectReadable(first: Rgb, second: Rgb, description: string) {
  expect(contrast(first, second), description).toBeGreaterThanOrEqual(4.5)
}

function checkTextPairs(values: Map<string, string>, block: number) {
  for (const [surfaceRole, foregroundRole] of textPairs) {
    expectReadable(
      requiredColor(values, surfaceRole),
      requiredColor(values, foregroundRole),
      `${surfaceRole}/${foregroundRole} block ${block}`,
    )
  }
}

function checkStatusPairs(values: Map<string, string>, block: number) {
  for (const role of statusRoles) {
    const color = requiredColor(values, role)
    for (const surface of ['--background', '--card', '--popover']) {
      const surfaceValue = values.get(surface)
      if (!surfaceValue?.startsWith('oklch(')) continue
      expectReadable(color, parseOklch(surfaceValue), `${role} on ${surface} block ${block}`)
    }
  }
}

test('default dark status colors remain readable', () => {
  const defaultDark = declarations(defaultSource)[1]
  if (!defaultDark) throw new Error('Missing default dark theme roles')
  const defaultDarkSurface = parseOklch('oklch(0.141 0.005 285.823)')
  for (const role of statusRoles) {
    expectReadable(requiredColor(defaultDark, role), defaultDarkSurface, `default dark ${role}`)
  }
})

test('alternate theme text pairs and status colors remain readable', () => {
  for (const source of themeSources) {
    for (const [index, values] of declarations(source).entries()) {
      const block = index + 1
      checkTextPairs(values, block)
      checkStatusPairs(values, block)
    }
  }
})
