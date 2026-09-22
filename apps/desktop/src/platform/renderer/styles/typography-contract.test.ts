import { expect, test } from 'bun:test'

const tokens = await Bun.file(new URL('../tokens.css', import.meta.url)).text()
const utilities = await Bun.file(new URL('./typography.css', import.meta.url)).text()
const entry = await Bun.file(new URL('../../../renderer/main.tsx', import.meta.url)).text()
const button = await Bun.file(new URL('../components/ui/button.tsx', import.meta.url)).text()
const feedTools = await Bun.file(
  new URL('../../../domains/sessions/renderer/feed/rows/feed-tools.tsx', import.meta.url),
).text()
const feedMarkdown = await Bun.file(
  new URL('../../../domains/sessions/renderer/feed/content/feed-markdown.tsx', import.meta.url),
).text()
const components = await Bun.file(new URL('../../../../components.json', import.meta.url)).json()
const map = await Bun.file(
  new URL('../../../../../../docs/design/typography.md', import.meta.url),
).text()

test('maps every product text surface and the shared primitive boundary', () => {
  for (const surface of [
    'Cockpit chrome and navigation',
    'Sessions roster',
    'Sessions feed',
    'Session composer and context',
    'Session inspector and work',
    'Tickets sidebar and detail',
    'Account and project dialogs',
    'Shared UI primitives',
  ]) {
    expect(map).toContain(`| ${surface} |`)
  }
  expect(map).toContain('## Composition boundary')
})

test('defines one app type scale without surface-specific aliases', () => {
  for (const role of ['title', 'heading', 'body', 'prose', 'control', 'meta', 'code']) {
    expect(tokens).toContain(`--text-${role}:`)
    expect(utilities).toContain(`var(--text-${role})`)
  }
  expect(tokens).toContain('--font-sans: "Geist Variable"')
  expect(tokens).toContain('--font-mono: "Geist Mono Variable"')
  expect(utilities).toContain('font-family: var(--font-mono)')
  expect(entry).toContain("import '@fontsource-variable/geist/wght.css'")
  expect(entry).toContain("import '@fontsource-variable/geist-mono/wght.css'")
  expect(tokens).toContain('--text-sm: var(--text-body)')
  expect(tokens).toContain('--text-base: var(--text-body)')
  expect(tokens).toContain('--text-xs: var(--text-control)')
  expect(tokens).toContain('--text-control: var(--text-body)')
  expect(tokens).toContain('--text-control--line-height: var(--text-body--line-height)')
  expect(tokens).toContain('--text-badge: var(--text-meta)')
  expect(button).toContain('px-2.5 text-xs in-data-[slot=button-group]')
  expect(tokens).toContain('--text-heading: 14px')
  expect(tokens).toContain('--text-prose: 14px')
  expect(components.tailwind.cssVariables).toBe(true)
  expect(tokens).not.toMatch(
    /--text-(session|ticket|composer)-(title|heading|body|meta|code|section)/,
  )
  expect(utilities).not.toContain('type-roster-meta')
})

test('keeps feed prose and tool summaries on the dominant rung', () => {
  expect(tokens).toContain('--text-body: 14px')
  expect(tokens).toContain('--text-body--line-height: 20px')
  expect(tokens).toContain('--text-prose: 14px')
  expect(tokens).toContain('--text-prose--line-height: 20px')
  expect(feedTools).toContain('type-body')
  expect(feedMarkdown).toContain('type-prose')
})

test('keeps direct size rungs out of app-owned product components', async () => {
  const sourceGlobs = [
    new Bun.Glob('../../../domains/{accounts,projects,sessions,tickets}/renderer/**/*.tsx'),
    new Bun.Glob('../cockpit/**/*.tsx'),
  ]
  const violations = []
  for (const sourceGlob of sourceGlobs) {
    for await (const path of sourceGlob.scan({ cwd: import.meta.dir, absolute: true })) {
      if (path.endsWith('.stories.tsx')) continue
      const source = await Bun.file(path).text()
      if (!/\b(text-(xs|sm|base|lg|xl|2xl)|type-roster-meta)\b/.test(source)) continue
      violations.push(path)
    }
  }
  expect(violations).toEqual([])
})
