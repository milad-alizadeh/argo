import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const directory = path.resolve(import.meta.dirname, '../..')
const sourceDirectory = path.join(import.meta.dirname, 'theme-sources')
const registry = 'https://www.shadcnblocks.com/r/base-nova/theme'
const names = ['supabase', 'linear', 'amber-minimal'] as const
const roles = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const
const values = z.record(z.string(), z.string().min(1))
const itemSchema = z.object({
  name: z.enum(names),
  type: z.literal('registry:theme'),
  cssVars: z.object({ theme: values, light: values, dark: values }),
  meta: z.object({ license: z.literal('https://www.shadcnblocks.com/license') }),
})
const excludedProperty = /^(font-|shadow(?:-|$)|radius$|spacing$|tracking-)/
const check = process.argv.includes('--check')
if (check && process.argv.includes('--update')) throw new Error('Choose --check or --update.')
await mkdir(sourceDirectory, { recursive: true })
const provenance = []
for (const name of names) {
  const url = `${registry}/${name}`
  const sourcePath = path.join(sourceDirectory, `${name}.json`)
  let source: string
  if (process.argv.includes('--update')) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    source = await response.text()
  } else {
    source = await readFile(sourcePath, 'utf8')
  }
  let record: unknown
  try {
    record = JSON.parse(source)
  } catch {
    throw new Error(`${name}: rejected 1 malformed registry JSON record.`)
  }
  source = `${JSON.stringify(record, null, 2)}\n`
  const parsed = itemSchema.safeParse(record)
  if (!parsed.success) throw new Error(`${name}: rejected 1 invalid registry item: ${parsed.error}`)
  const item = parsed.data
  if (item.name !== name) throw new Error(`${name}: rejected 1 mismatched theme identity.`)
  const filtered: Record<string, string[]> = {}
  for (const mode of ['light', 'dark'] as const) {
    const unknown = Object.keys(item.cssVars[mode]).filter(
      (key) => !roles.some((role) => role === key) && !excludedProperty.test(key),
    )
    if (unknown.length)
      throw new Error(
        `${name}/${mode}: rejected ${unknown.length} unknown properties: ${unknown.join(', ')}`,
      )
    filtered[mode] = Object.keys(item.cssVars[mode])
      .filter((key) => excludedProperty.test(key))
      .sort()
    for (const role of roles) {
      const value = item.cssVars[mode][role]
      if (!value || /[;{}\n\r]/.test(value))
        throw new Error(`${name}/${mode}: rejected 1 invalid ${role}.`)
    }
  }
  const digest = createHash('sha256').update(source).digest('hex')
  const blocks = (['light', 'dark'] as const).map((mode) => {
    const selector = `:root[data-theme="${name}"]${mode === 'dark' ? '.dark' : ''}`
    return `${selector} {\n${roles.map((role) => `  --${role}: ${item.cssVars[mode][role]};`).join('\n')}\n}`
  })
  const css = `/* Source: ${url}; SHA-256: ${digest}; license: ${item.meta.license}. */\n${blocks.join('\n\n')}\n`
  const target = path.join(directory, 'src/platform/renderer/styles/themes', `${name}.css`)
  if (check) {
    if ((await readFile(target, 'utf8')) !== css)
      throw new Error(`${name}: installed colours differ from the recorded registry source.`)
  } else {
    await writeFile(sourcePath, source)
    await writeFile(target, css)
  }
  provenance.push({ name, url, sha256: digest, license: item.meta.license, filtered })
}
const manifestPath = path.join(sourceDirectory, 'provenance.json')
const manifest = `${JSON.stringify({ registry, installedRoles: roles, omittedSections: { 'cssVars.theme': true, css: true }, themes: provenance }, null, 2)}\n`
if (check) {
  if ((await readFile(manifestPath, 'utf8')) !== manifest)
    throw new Error('Theme provenance is stale.')
} else {
  await writeFile(manifestPath, manifest)
}
console.info(`${check ? 'Verified' : 'Installed'} ${names.length} registry colour themes.`)
