import { expect, test } from 'bun:test'
import postcss from 'postcss'
import { compile } from 'tailwindcss'
import { THEMES } from '@/platform/contract/appearance'

const sources = await Promise.all(
  THEMES.map((theme) => Bun.file(new URL(`./themes/${theme}.css`, import.meta.url)).text()),
)

const bindings = postcss.parse(
  await Bun.file(new URL('./theme-bindings.css', import.meta.url)).text(),
)
const required = new Set<string>()
bindings.walkDecls((declaration) => {
  expect(declaration.value.startsWith('var(')).toBe(true)
  expect(declaration.value.endsWith(')')).toBe(true)
  required.add(declaration.value.slice(4, -1))
})

function declaredRoles(source: string) {
  const ast = postcss.parse(source)
  const rules = ast.nodes.filter((node) => node.type === 'rule')
  expect(rules).toHaveLength(2)
  return rules.map((rule) => {
    const declarations: string[] = []
    rule.walkDecls((declaration) => {
      declarations.push(declaration.prop)
    })
    if (new Set(declarations).size !== declarations.length) throw new Error('Duplicate theme role')
    for (const role of required) {
      if (!declarations.includes(role)) throw new Error(`Missing theme role ${role}`)
    }
    return declarations.sort()
  })
}

test('every registered theme declares exactly the same roles in both appearances', async () => {
  const roles: string[][] = []
  for (const source of sources) {
    roles.push(...declaredRoles(source))
    await compile(source)
  }
  for (const declared of roles) expect(declared).toEqual(roles[0])
  expect(roles).toHaveLength(THEMES.length * 2)
})

test('theme catalog supplies each explicit appearance and only Default owns the root fallback', () => {
  for (const [index, theme] of THEMES.entries()) {
    const source = sources[index]
    if (!source) throw new Error('Missing theme source')
    const rules = postcss.parse(source).nodes.filter((node) => node.type === 'rule')
    expect(rules[0]?.selector.split(',').map((selector) => selector.trim())).toEqual(
      theme === 'default'
        ? [':root', `:root[data-theme="${theme}"]`]
        : [`:root[data-theme="${theme}"]`],
    )
    expect(rules[1]?.selector.split(',').map((selector) => selector.trim())).toEqual(
      theme === 'default'
        ? [`:root[data-theme="${theme}"].dark`, ':root.dark:not([data-theme])']
        : [`:root[data-theme="${theme}"].dark`],
    )
    for (const rule of rules) {
      rule.walkDecls((declaration) => {
        expect(required.has(declaration.prop)).toBe(true)
      })
    }
  }
})

test('a role omitted from every theme still fails its actual binding contract', () => {
  const role = required.values().next().value
  if (!role) throw new Error('Missing theme bindings')
  for (const source of sources) {
    const ast = postcss.parse(source)
    ast.walkDecls(role, (declaration) => {
      declaration.remove()
    })
    expect(() => declaredRoles(ast.toString())).toThrow(`Missing theme role ${role}`)
  }
})

test('duplicate role declarations fail independently of complete binding coverage', () => {
  for (const source of sources) {
    const ast = postcss.parse(source)
    ast.walkRules((rule) => {
      rule.append({ prop: '--background', value: 'white' })
    })
    expect(() => declaredRoles(ast.toString())).toThrow('Duplicate theme role')
  }
})

test('Theme changes preserve the shared status meanings in each appearance', () => {
  const statusRoles = [
    '--status-success',
    '--status-warning',
    '--status-danger',
    '--status-neutral',
  ]
  const statuses = sources.map((source) => {
    const rules = postcss.parse(source).nodes.filter((node) => node.type === 'rule')
    return rules.map((rule) => {
      const values = new Map<string, string>()
      rule.walkDecls((declaration) => {
        if (statusRoles.includes(declaration.prop)) values.set(declaration.prop, declaration.value)
      })
      expect(values.size).toBe(statusRoles.length)
      return statusRoles.map((role) => values.get(role))
    })
  })
  for (const appearance of [0, 1]) {
    for (let role = 0; role < statusRoles.length; role += 1) {
      const colors = statuses.map((theme) => theme[appearance]?.[role])
      expect(new Set(colors).size, `${statusRoles[role]} differs by theme`).toBe(THEMES.length)
      expect(colors[0], `${statusRoles[role]} differs by mode`).not.toBe(colors[THEMES.length])
    }
  }
})
