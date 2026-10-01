import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const require = createRequire(path.join(root, 'package.json'))
const postcss = require('postcss')
const ts = require('typescript')
const sourceRoot = 'apps/desktop/src'
const tokenPath = 'apps/desktop/src/platform/renderer/tokens.css'
const files = []
function walk(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (/\.(css|tsx?|mts)$/.test(file)) files.push(file)
  }
}
walk(sourceRoot)
files.sort()
const definitions = []
const usages = []
const candidates = []
const rawCssColors = []
const runtimeDefinitions = []
function category(file) {
  if (/protocol-generated\//.test(file)) return 'generated-protocol'
  if (/\.(stories|test|vitest)\.[^.]+$/.test(file)) return 'verification'
  if (/\/components\/ui\//.test(file)) return 'registry-ui'
  return 'application'
}
function addReferences(text, file, line, kind, owner) {
  for (const match of text.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    usages.push({ name: match[1], file, line, kind, category: category(file), fallback: Boolean(match[2]), owner })
  }
  if (/^--(?:size|color|spacing|inset|radius|font|text|duration|shadow|code|background|card|muted|foreground|border|primary|secondary|accent|ring|popover|input|success|destructive|diff|sidebar|chart|ticket|icon|session|attachment|context|panel|shiki|collapsible)[\w-]*$/.test(text)) {
    usages.push({ name: text, file, line, kind: 'named-string', category: category(file) })
  }
  for (const match of text.matchAll(/\(\s*(--[\w-]+)\s*\)/g)) {
    if (match.index > 2 && text.slice(match.index - 3, match.index) === 'var') continue
    usages.push({ name: match[1], file, line, kind: 'utility-variable', category: category(file) })
  }
}
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  if (file.endsWith('.css')) {
    const tree = postcss.parse(source, { from: file })
    tree.walkDecls((declaration) => {
      const scopes = []
      for (let node = declaration.parent; node && node.type !== 'root'; node = node.parent) {
        scopes.unshift({ selector: node.type === 'atrule' ? `@${node.name} ${node.params}`.trim() : node.selector, line: node.source.start.line })
      }
      if (declaration.prop.startsWith('--')) {
        definitions.push({ name: declaration.prop, value: declaration.value.replace(/\s+/g, ' ').trim(), file, line: declaration.source.start.line, scopes, category: category(file) })
      }
      addReferences(declaration.value, file, declaration.source.start.line, 'css-var', declaration.prop.startsWith('--') ? declaration.prop : undefined)
      if (!declaration.prop.startsWith('--') && /#[\da-fA-F]{3,8}\b|\b(?:rgb|rgba|oklch|hsl|hsla)\(/.test(declaration.value)) {
        rawCssColors.push({ property: declaration.prop, value: declaration.value, file, line: declaration.source.start.line })
      }
    })
    tree.walkAtRules('apply', (rule) => {
      for (const candidate of rule.params.split(/\s+/)) candidates.push({ candidate, file, line: rule.source.start.line, category: category(file) })
    })
  } else {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    function visit(node) {
      if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && node.name.text.startsWith('--')) {
        runtimeDefinitions.push({ name: node.name.text, value: node.initializer.getText(tree), file, line: tree.getLineAndCharacterOfPosition(node.name.getStart(tree)).line + 1, kind: 'inline-style-property' })
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setProperty' && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('--')) {
        runtimeDefinitions.push({ name: node.arguments[0].text, value: node.arguments[1]?.getText(tree), file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, kind: 'runtime-set-property' })
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1
        addReferences(node.text, file, line, 'typescript-string')
        for (const match of node.text.matchAll(/\[(--[\w-]+):([^\]]+)\]/g)) runtimeDefinitions.push({ name: match[1], value: match[2], file, line, kind: 'arbitrary-utility-property' })
        for (const candidate of node.text.split(/\s+/)) {
          if (/^(?:[\w\[\]().=,>&!*-]+:)*!?(?:bg|text|border|outline|ring|fill|stroke|decoration|shadow|rounded|gap|p[xytrblse]?|m[xytrblse]?|space-[xy]|size|h|w|min-h|min-w|max-h|max-w|inset|top|bottom|left|right|leading|tracking|font|duration|ease|type)-/.test(candidate)) {
            candidates.push({ candidate, file, line, category: category(file) })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
}
const tokens = definitions.filter((definition) => definition.file === tokenPath)
const uniqueNames = [...new Set(tokens.map((definition) => definition.name))].sort()
function aliasUtility(name, candidate) {
  const base = candidate.split(':').at(-1).replace(/^!/, '').split('/')[0]
  let suffix, prefixes
  if (name.startsWith('--color-')) { suffix = name.slice(8); prefixes = ['bg', 'text', 'border', 'border-x', 'border-y', 'border-t', 'border-b', 'border-s', 'border-e', 'outline', 'ring', 'fill', 'stroke', 'decoration', 'shadow'] }
  else if (name.startsWith('--spacing-')) { suffix = name.slice(10); prefixes = ['gap', 'gap-x', 'gap-y', 'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'ps', 'pe', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'ms', 'me', 'space-x', 'space-y', 'size', 'h', 'w', 'inset', 'top', 'bottom', 'left', 'right'] }
  else if (name.startsWith('--text-') && !name.slice(7).includes('--')) { suffix = name.slice(7); prefixes = ['text'] }
  else if (name.startsWith('--radius-')) { suffix = name.slice(9); prefixes = ['rounded', 'rounded-t', 'rounded-b', 'rounded-l', 'rounded-r'] }
  else if (name.startsWith('--font-')) { suffix = name.slice(7); prefixes = ['font'] }
  else if (name.startsWith('--shadow-')) { suffix = name.slice(9); prefixes = ['shadow'] }
  else if (name.startsWith('--ease-')) { suffix = name.slice(7); prefixes = ['ease'] }
  else if (name.startsWith('--transition-duration-')) { suffix = name.slice(22); prefixes = ['duration'] }
  return prefixes?.some((prefix) => base === `${prefix}-${suffix}`) ?? false
}
const utilityUsages = []
for (const name of uniqueNames) {
  for (const candidate of candidates) {
    if (aliasUtility(name, candidate.candidate)) utilityUsages.push({ name, ...candidate, kind: 'utility-candidate' })
  }
}
const directReaders = [...usages.filter((usage) => usage.file !== tokenPath && usage.category !== 'verification' && usage.category !== 'generated-protocol'), ...utilityUsages.filter((usage) => usage.category !== 'verification')]
const reachable = new Set(directReaders.map((usage) => usage.name))
for (const usage of utilityUsages) {
  if (usage.category !== 'verification' && usage.name.startsWith('--text-')) reachable.add(`${usage.name}--line-height`)
}
let changed = true
while (changed) {
  changed = false
  for (const usage of usages.filter((usage) => usage.file === tokenPath)) {
    if (reachable.has(usage.owner) && !reachable.has(usage.name)) { reachable.add(usage.name); changed = true }
  }
}
const valueGroups = new Map()
const allValueGroups = new Map()
const declarationGroups = new Map()
for (const token of tokens) {
  const valueKey = `${token.scopes.map((scope) => scope.selector).join(' / ')}|${token.value}`
  valueGroups.set(valueKey, [...(valueGroups.get(valueKey) ?? []), token])
  allValueGroups.set(token.value, [...(allValueGroups.get(token.value) ?? []), token])
  const scopeKey = `${JSON.stringify(token.scopes)}|${token.name}`
  declarationGroups.set(scopeKey, [...(declarationGroups.get(scopeKey) ?? []), token])
}
const defaultDefinitions = new Set()
for (const vendorPath of ['tailwindcss/theme.css', 'shadcn/tailwind.css']) {
  postcss.parse(fs.readFileSync(require.resolve(vendorPath), 'utf8')).walkDecls((declaration) => defaultDefinitions.add(declaration.prop))
}
const defined = new Set([...definitions, ...runtimeDefinitions].map((definition) => definition.name))
const unresolved = usages.filter((usage) => usage.category === 'application' && !defined.has(usage.name) && !defaultDefinitions.has(usage.name) && !usage.name.startsWith('--tw-'))
const { compile } = require('@tailwindcss/node')
const stylePath = path.join(root, 'apps/desktop/src/platform/renderer/styles/globals.css')
const compiler = await compile(fs.readFileSync(stylePath, 'utf8'), { base: path.dirname(stylePath), from: stylePath, onDependency() {} })
const probeCandidates = ['bg-background', 'bg-primary', 'text-primary-foreground', 'text-xs', 'text-sm', 'text-base', 'text-body-weight', 'text-body-tracking', 'pr-(--inset-session-inspector-toggle)']
const compilerProbe = []
postcss.parse(compiler.build(probeCandidates)).walkRules((rule) => {
  if (rule.selector.startsWith('.') && /bg-background|bg-primary|text-primary-foreground|text-xs|text-sm|text-base|text-body-weight|text-body-tracking|inset-session-inspector-toggle/.test(rule.selector)) compilerProbe.push({ selector: rule.selector, declarations: rule.nodes.filter((node) => node.type === 'decl').map((node) => ({ property: node.prop, value: node.value })) })
})
const output = {
  auditedRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  modifiedTrackedSourceFiles: execFileSync('git', ['diff', '--name-only', 'HEAD', '--', sourceRoot], { encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  dependencyVersions: { tailwindcss: require('tailwindcss/package.json').version, postcss: require('postcss/package.json').version, typescript: require('typescript/package.json').version, tailwindNode: JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve('@tailwindcss/node')), '../package.json'), 'utf8')).version },
  generatedDate: '2026-10-01',
  method: 'PostCSS declaration AST and TypeScript string/template AST. Utilities are static candidates matched by known Tailwind namespaces; no runtime reachability proof. Exact values are whitespace-normalized, not color-equivalence normalized. Unresolved references can be optional or vendor-owned. All src CSS/TS is scanned; production excludes stories/tests/generated protocol.',
  summary: { files: files.length, filesByCategory: Object.fromEntries(['application', 'registry-ui', 'verification', 'generated-protocol'].map((kind) => [kind, files.filter((file) => category(file) === kind).length])), tokenDeclarations: tokens.length, uniqueGlobalTokens: uniqueNames.length, customPropertiesOutsideContract: definitions.filter((definition) => definition.file !== tokenPath).length, sameScopeRedeclarations: [...declarationGroups.values()].filter((group) => group.length > 1).length, equalValueGroups: [...valueGroups.values()].filter((group) => new Set(group.map((token) => token.name)).size > 1).length, noStaticProductionReaderCandidates: uniqueNames.filter((name) => !reachable.has(name)).length },
  tokenInventory: uniqueNames.map((name) => ({ name, definitions: tokens.filter((token) => token.name === name), productionReaders: directReaders.filter((usage) => usage.name === name), contractReaders: usages.filter((usage) => usage.file === tokenPath && usage.name === name), staticallyReachable: reachable.has(name) })),
  sameScopeRedeclarations: [...declarationGroups.values()].filter((group) => group.length > 1),
  exactEqualValueGroups: [...valueGroups.values()].filter((group) => new Set(group.map((token) => token.name)).size > 1),
  crossScopeEqualValueGroups: [...allValueGroups.values()].filter((group) => new Set(group.map((token) => token.name)).size > 1 && new Set(group.map((token) => token.scopes.map((scope) => scope.selector).join('/'))).size > 1),
  noStaticProductionReaderCandidates: uniqueNames.filter((name) => !reachable.has(name)),
  localDefinitions: definitions.filter((definition) => definition.file !== tokenPath),
  runtimeDefinitions,
  unresolvedApplicationReferences: unresolved,
  rawCssColorsOutsideContract: rawCssColors.filter((declaration) => declaration.file !== tokenPath),
  utilityCandidates: candidates.filter((candidate) => candidate.category === 'application'),
  compilerProbe,
}
fs.writeFileSync(path.join(root, 'docs/research/2026-10-01-token-inventory.json'), `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify({ summary: output.summary, redeclarations: output.sameScopeRedeclarations, noStaticProductionReaderCandidates: output.noStaticProductionReaderCandidates, unresolved: [...new Set(unresolved.map((usage) => usage.name))], rawCssColors: output.rawCssColorsOutsideContract }, null, 2))
