import { expect, test } from 'bun:test'
import {
  cssTypographyConsumers,
  productionStylingOwner,
  typescriptTypographyConsumers,
  undefinedTypographyRecipes,
} from '../../../../tests/styling/typography-consumers'
import { TYPOGRAPHY_RECIPES } from '../lib/text-sizes'

const tokens = await Bun.file(new URL('../tokens.css', import.meta.url)).text()
const utilities = await Bun.file(new URL('./typography.css', import.meta.url)).text()
const entry = await Bun.file(new URL('../../../renderer/main.tsx', import.meta.url)).text()
const globals = await Bun.file(new URL('./globals.css', import.meta.url)).text()

function hasTailwindTypographyOverride(source: string) {
  return /--text-[a-z][a-z-]*\s*:/.test(source)
}

test('keeps app typography outside Tailwind size metadata', () => {
  expect(hasTailwindTypographyOverride(tokens)).toBe(false)
  expect(hasTailwindTypographyOverride(':root { --text-sm: 14px; }')).toBe(true)
  expect(tokens).toContain('--font-sans: "Geist Variable"')
  expect(tokens).toContain('--font-mono: "Geist Mono Variable"')
  expect(entry).toContain("import '@fontsource-variable/geist/wght.css'")
  expect(entry).toContain("import '@fontsource-variable/geist-mono/wght.css'")
})

test('each app recipe owns complete typography metrics with ordinary specificity', () => {
  for (const role of TYPOGRAPHY_RECIPES) {
    const declaration = utilities.match(new RegExp(`@utility type-${role} \\{([^}]+)\\}`))?.[1]
    expect(declaration).toBeDefined()
    for (const metric of ['font-size', 'line-height', 'font-weight', 'letter-spacing']) {
      expect(declaration).toContain(`${metric}: var(--typography-`)
    }
  }
  expect(utilities).not.toMatch(/\.type-[\w-]+\.type-/)
  expect(utilities).not.toContain('!important')
  expect(globals).not.toContain('[data-slot="icon"]')
  expect(globals).not.toContain('--tw-ring-shadow')
  expect(globals).not.toContain('font-weight:')
})

test('app metadata defines each referenced metric once', () => {
  const declarations = [...tokens.matchAll(/(--typography-[\w-]+)\s*:/g)].map((match) => match[1])
  expect(new Set(declarations).size).toBe(declarations.length)
  for (const reference of utilities.matchAll(/var\((--typography-[\w-]+)/g)) {
    expect(declarations).toContain(reference[1])
  }
})

test('keeps feed prose and tool summaries on the dominant rung', async () => {
  const feedTools = await Bun.file(
    new URL('../../../domains/sessions/renderer/feed/tools/feed-tools.tsx', import.meta.url),
  ).text()
  const feedMarkdown = await Bun.file(
    new URL('../../../domains/sessions/renderer/feed/content/feed-markdown.tsx', import.meta.url),
  ).text()
  expect(tokens).toContain('--typography-body-size: 14px')
  expect(tokens).toContain('--typography-body-line-height: 20px')
  expect(tokens).toContain('--typography-prose-size: 14px')
  expect(tokens).toContain('--typography-prose-line-height: 20px')
  expect(feedTools).toContain('type-body')
  expect(feedMarkdown).toContain('type-prose')
})

test('rejects undefined typography recipes in production styling owners', async () => {
  const root = new URL('../../../..', import.meta.url).pathname
  const violations: string[] = []
  for await (const path of new Bun.Glob('src/**/*.{ts,tsx,mts,css}').scan(root)) {
    if (!productionStylingOwner(path)) continue
    const source = await Bun.file(`${root}/${path}`).text()
    const classes = path.endsWith('.css')
      ? cssTypographyConsumers(source)
      : typescriptTypographyConsumers(source, path)
    for (const recipe of undefinedTypographyRecipes(classes)) violations.push(`${path}: ${recipe}`)
  }
  expect(violations).toEqual([])
})

test('consumer checks cover variants and recipes without treating prose as classes', () => {
  const source = `
    import example from './type-import';
    // type-comment is not a class.
    const readerText = 'type-prose-example';
    const label = <p>type-reader-text</p>;
    const recipes = { title: 'md:type-caption', body: 'type-body text-sm' };
    const control = cva('type-control', { variants: { size: { small: 'hover:!type-typo' } } });
    const view = <div className={cn('type-code-content text-xs', true ? 'type-meta' : '[&_h1]:type-missing', t('type-translation'))} />;
    cn({ 'md:type-conditional': true });
  `
  const consumers = typescriptTypographyConsumers(source)
  expect(undefinedTypographyRecipes(consumers).sort()).toEqual([
    'type-caption',
    'type-conditional',
    'type-missing',
    'type-typo',
  ])
  expect(consumers).toContain('type-code-content')
  expect(consumers).not.toContain('type-translation')
  expect(
    productionStylingOwner(
      'src/domains/sessions/renderer/composer/editor/session-composer-editor.tsx',
    ),
  ).toBe(true)
  expect(
    productionStylingOwner(
      'src/domains/sessions/renderer/composer/editor/session-composer-editor.stories.tsx',
    ),
  ).toBe(false)
})

test('neutral local names retain their lexical class context', () => {
  const source = `
    function first() { const treatment = 'type-caption'; return <p className={treatment} />; }
    function second() { const treatment = 'type-body'; return <p className={treatment} />; }
  `
  expect(undefinedTypographyRecipes(typescriptTypographyConsumers(source))).toEqual([
    'type-caption',
  ])
})

test('CSS consumers reject unknown recipes but distinguish the scoped code adapter', () => {
  const source = `/* .type-comment {} */
    @import 'type-import';
    @utility type-body { font-size: 14px; }
    .type-code-content :is(code, pre) { font-family: monospace; }
    .owner { @apply md:type-caption type-body text-base; content: 'type-prose-example'; }
    .type-unknown { color: red; }
  `
  expect(undefinedTypographyRecipes(cssTypographyConsumers(source)).sort()).toEqual([
    'type-caption',
    'type-unknown',
  ])
})
