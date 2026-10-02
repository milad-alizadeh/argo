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
  const linear = [l ** 3, m ** 3, s ** 3]
  return [
    4.0767416621 * linear[0]! - 3.3077115913 * linear[1]! + 0.2309699292 * linear[2]!,
    -1.2684380046 * linear[0]! + 2.6097574011 * linear[1]! - 0.3413193965 * linear[2]!,
    -0.0041960863 * linear[0]! - 0.7034186147 * linear[1]! + 1.707614701 * linear[2]!,
  ].map((channel) => Math.min(1, Math.max(0, channel))) as unknown as Rgb
}

function parseOklch(value: string): Rgb {
  const match = value.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/)
  if (!match) throw new Error(`Expected explicit OKLCH color, got ${value}`)
  return toRgb(Number(match[1]), Number(match[2]), Number(match[3]))
}

function luminance(rgb: Rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function contrast(first: Rgb, second: Rgb) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}

function declarations(css: string) {
  return postcss.parse(css).nodes.filter((node) => node.type === 'rule').map((node) => {
    const values = new Map<string, string>()
    node.walkDecls((declaration) => values.set(declaration.prop, declaration.value))
    return values
  })
}

const textPairs = [
  ['--background', '--foreground'], ['--card', '--card-foreground'], ['--popover', '--popover-foreground'],
  ['--primary', '--primary-foreground'], ['--secondary', '--secondary-foreground'], ['--muted', '--muted-foreground'],
  ['--accent', '--accent-foreground'], ['--sidebar', '--sidebar-foreground'],
  ['--sidebar-primary', '--sidebar-primary-foreground'], ['--sidebar-accent', '--sidebar-accent-foreground'],
] as const

test('theme text pairs and status colors remain readable in both appearances', () => {
  const statusRoles = ['--status-success', '--status-warning', '--status-danger', '--status-neutral']
  const defaultDark = declarations(defaultSource)[1]
  if (!defaultDark) throw new Error('Missing default dark theme roles')
  const defaultDarkSurface = 'oklch(0.141 0.005 285.823)'
  for (const role of statusRoles) {
    expect(
      contrast(parseOklch(defaultDark.get(role)!), parseOklch(defaultDarkSurface)),
      `default dark ${role}`,
    ).toBeGreaterThanOrEqual(4.5)
  }
  for (const source of themeSources) {
    for (const [index, values] of declarations(source).entries()) {
      for (const [surfaceRole, foregroundRole] of textPairs) {
        const ratio = contrast(parseOklch(values.get(surfaceRole)!), parseOklch(values.get(foregroundRole)!))
        expect(ratio, `${surfaceRole}/${foregroundRole} block ${index + 1}`).toBeGreaterThanOrEqual(4.5)
      }
      for (const role of statusRoles) {
        const color = parseOklch(values.get(role)!)
        for (const surface of ['--background', '--card', '--popover']) {
          const surfaceValue = values.get(surface)
          if (!surfaceValue?.startsWith('oklch(')) continue
          expect(
            contrast(color, parseOklch(surfaceValue)),
            `${role} ${values.get(role)} on ${surface} block ${index + 1}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  }
})
