import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const outputRoot = process.cwd()
const root = path.resolve(process.argv[2] ?? outputRoot)
const require = createRequire(path.join(root, 'package.json'))
const ts = require('typescript')
const postcss = require('postcss')
const sourceRoot = 'apps/desktop/src'
const registryRoot = `${sourceRoot}/platform/renderer/components/ui/`
const outputPath = 'docs/research/2026-10-01-component-inventory.json'
const startingRevision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const files = []
function walk(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (/\.(tsx?|css)$/.test(file)) files.push(file)
  }
}
walk(sourceRoot)
files.sort()
const verification = (file) => /\.(stories|test|vitest)\.[^.]+$/.test(file)
const generated = (file) => file.includes('/protocol-generated/')
const sourceFiles = files.filter((file) => !verification(file) && !generated(file))
const fileSet = new Set(files)
function resolveImport(from, specifier) {
  const base = specifier.startsWith('@/')
    ? path.posix.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)) : null
  if (!base) return null
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => fileSet.has(candidate)) ?? null
}
function lineOf(tree, node) { return tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 }
const utilityPattern = /^(?:[^\s]+:)*!?(?:type|text|bg|border|ring|outline|shadow|rounded|font|leading|tracking|size|h|w|min-h|min-w|max-h|max-w|p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset|top|left|right|bottom|opacity|duration|ease|fill|stroke)-/
function utilityTokens(value) { return value.split(/\s+/).filter((token) => utilityPattern.test(token)) }
function inspect(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const result = { file, lines: source.split('\n').length, hash: createHash('sha256').update(source).digest('hex'), exports: [], components: [], imports: [], jsx: [], utilityStrings: [], inlineStyles: [], stylingCalls: [] }
  function visit(node) {
    const line = lineOf(tree, node)
    if (ts.isImportDeclaration(node)) {
      result.imports.push({ specifier: node.moduleSpecifier.text, resolved: resolveImport(file, node.moduleSpecifier.text), line, bindings: node.importClause?.getText(tree) ?? '' })
    }
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) result.exports.push(...node.exportClause.elements.map((item) => ({ name: item.name.text, line, kind: 'named-export' })))
      if (node.moduleSpecifier) result.imports.push({ specifier: node.moduleSpecifier.text, resolved: resolveImport(file, node.moduleSpecifier.text), line, bindings: node.exportClause?.getText(tree) ?? '*', reexport: true })
    }
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name) result.exports.push({ name: node.name.text, line, kind: ts.SyntaxKind[node.kind] })
      if (ts.isVariableStatement(node)) result.exports.push(...node.declarationList.declarations.filter((item) => ts.isIdentifier(item.name)).map((item) => ({ name: item.name.text, line, kind: 'variable' })))
    }
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) result.components.push({ name: node.name.text, line })
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^[A-Z]/.test(node.name.text) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer) || (ts.isCallExpression(node.initializer) && /(?:memo|forwardRef)/.test(node.initializer.expression.getText(tree))))) result.components.push({ name: node.name.text, line })
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      result.jsx.push({ tag: node.tagName.getText(tree), line, props: node.attributes.properties.map((attribute) => ts.isJsxSpreadAttribute(attribute) ? { name: '...', value: attribute.expression.getText(tree) } : { name: attribute.name.getText(tree), value: attribute.initializer?.getText(tree) ?? 'true' }).filter((attribute) => ['className', 'style', 'variant', 'size', 'tone', 'render', 'asChild', 'disabled', 'data-slot', '...'].includes(attribute.name)) })
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const utilities = utilityTokens(node.text)
      if (utilities.length) result.utilityStrings.push({ line, value: node.text, utilities, templateFragment: ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) })
    }
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'style') result.inlineStyles.push({ line, value: node.initializer?.getText(tree) })
    if (ts.isCallExpression(node) && /(?:^|\.)(?:cva|cn|clsx|createCn|setProperty|createElement|createPortal)$/.test(node.expression.getText(tree))) result.stylingCalls.push({ line, name: node.expression.getText(tree), value: node.getText(tree).slice(0, 900) })
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return result
}
const fixture = inspect('apps/desktop/src/sample.tsx', 'import {Badge as Tag} from "@/platform/renderer/components/ui/badge"; export function Sample(){return <Tag variant="destructive" className={cn("px-2", active && "text-warn")} style={{width: value}}/>} const Memo = memo(() => <span/>);')
assert.equal(fixture.jsx[0].tag, 'Tag')
assert.equal(fixture.jsx[0].props.find((property) => property.name === 'variant').value, '"destructive"')
assert.deepEqual(fixture.utilityStrings.flatMap((entry) => entry.utilities), ['px-2', 'text-warn'])
assert.equal(fixture.inlineStyles.length, 1)
assert.deepEqual(fixture.components.map((entry) => entry.name), ['Sample', 'Memo'])
const inspections = files.filter((file) => !file.endsWith('.css') && !generated(file)).map((file) => inspect(file, fs.readFileSync(path.join(root, file), 'utf8')))
const components = inspections.filter((inspection) => !verification(inspection.file) && (inspection.file.endsWith('.tsx') || inspection.jsx.length > 0))
const support = inspections.filter((inspection) => !verification(inspection.file) && !inspection.file.endsWith('.tsx') && (inspection.utilityStrings.length || inspection.stylingCalls.some((call) => /createCn|setProperty|createElement|createPortal/.test(call.name))))
for (const component of components) {
  component.registryDirectory = component.file.startsWith(registryRoot)
  component.consumers = inspections.flatMap((inspection) => inspection.imports.filter((entry) => entry.resolved === component.file).map((entry) => ({ file: inspection.file, line: entry.line, bindings: entry.bindings, verification: verification(inspection.file) })))
  component.adjacentStories = files.filter((file) => file === component.file.replace(/\.tsx$/, '.stories.tsx'))
  component.storyImporters = component.consumers.filter((consumer) => consumer.file.includes('.stories.'))
  component.overrideSites = component.jsx.filter((entry) => /^[A-Z]/.test(entry.tag) && entry.props.some((property) => ['className', 'style', 'render', 'asChild'].includes(property.name)))
}
const stylesheets = sourceFiles.filter((file) => file.endsWith('.css')).map((file) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const tree = postcss.parse(source, { from: file })
  const rules = []
  const declarations = []
  tree.walkRules((rule) => rules.push({ selector: rule.selector, line: rule.source.start.line, layer: [...function* () { for (let owner = rule.parent; owner; owner = owner.parent) if (owner.type === 'atrule') yield `@${owner.name} ${owner.params}` }()].reverse().join(' / '), declarations: rule.nodes.filter((node) => node.type === 'decl').map((declaration) => ({ property: declaration.prop, value: declaration.value, important: declaration.important ?? false, line: declaration.source.start.line })), applies: rule.nodes.filter((node) => node.type === 'atrule' && node.name === 'apply').map((node) => node.params) }))
  tree.walkDecls((declaration) => declarations.push({ property: declaration.prop, value: declaration.value, important: declaration.important ?? false, line: declaration.source.start.line, scopes: [...function* () { for (let owner = declaration.parent; owner && owner.type !== 'root'; owner = owner.parent) yield owner.type === 'atrule' ? `@${owner.name} ${owner.params}` : owner.selector }()].reverse() }))
  return { file, hash: createHash('sha256').update(source).digest('hex'), lines: source.split('\n').length, rules, declarations }
})
const groups = new Map()
for (const component of components.filter((entry) => !entry.registryDirectory)) {
  for (const entry of component.utilityStrings.filter((entry) => !entry.templateFragment)) {
    const normalized = entry.value.trim().split(/\s+/).sort().join(' ')
    if (normalized.split(' ').length < 3) continue
    groups.set(normalized, [...(groups.get(normalized) ?? []), { file: component.file, line: entry.line, value: entry.value }])
  }
}
const duplicates = [...groups.entries()].filter(([, occurrences]) => new Set(occurrences.map((entry) => entry.file)).size > 1).map(([normalized, occurrences]) => ({ normalized, occurrences })).sort((left, right) => right.occurrences.length - left.occurrences.length)
const output = {
  auditedRevision: startingRevision,
  sourceCheckout: root,
  modifiedTrackedSourceFiles: execFileSync('git', ['-C', root, 'diff', '--name-only', 'HEAD', '--', sourceRoot], { encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  generatedDate: '2026-10-01',
  method: 'TypeScript AST covers every src TSX file except suffix-marked stories/tests. All non-generated src TS imports support reverse references. PostCSS covers every src CSS file. Utility strings include constants, cn arguments, conditional branches and template fragments. Imports are source references, not bundle reachability. Exported types are retained, not counted as components. Capitalized function detection is a candidate list, not a rendered component proof. Exact duplicate strings ignore order but do not resolve interpolation or semantic equivalence. Story import presence does not prove state, appearance or interaction coverage.',
  summary: { allSourceFiles: files.length, parsedTypeScriptFiles: inspections.length, componentFiles: components.length, registryDirectoryFiles: components.filter((entry) => entry.registryDirectory).length, applicationComponentFiles: components.filter((entry) => !entry.registryDirectory).length, componentCandidates: components.reduce((count, entry) => count + entry.components.length, 0), stylesheetFiles: stylesheets.length, stylingSupportFiles: support.length, applicationOverrideSites: components.filter((entry) => !entry.registryDirectory).reduce((count, entry) => count + entry.overrideSites.length, 0), duplicateStringGroups: duplicates.length },
  components, stylesheets, stylingSupport: support, duplicateStringGroups: duplicates,
}
assert.equal(new Set(components.map((entry) => entry.file)).size, components.length)
assert.equal(components.length, sourceFiles.filter((file) => file.endsWith('.tsx')).length)
assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), startingRevision, 'Source revision changed during the scan')
for (const entry of [...inspections, ...stylesheets]) {
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, entry.file))).digest('hex'), entry.hash, `Source changed during the scan: ${entry.file}`)
}
const decisions = JSON.parse(fs.readFileSync(path.join(outputRoot, 'docs/research/2026-10-01-component-decisions.json'), 'utf8'))
const decisionMap = new Map(Object.entries(decisions).flatMap(([prefix, entries]) => Object.entries(entries).map(([stem, decision]) => [`${sourceRoot}/${prefix}/${stem}.tsx`, decision])))
const applicationComponents = components.filter((entry) => !entry.registryDirectory)
assert.deepEqual([...decisionMap.keys()].sort(), applicationComponents.map((entry) => entry.file).sort(), 'Every application TSX file must have one explicit disposition, with no stale entries')
for (const component of applicationComponents) {
  const [category, disposition, rules] = decisionMap.get(component.file)
  assert(['pattern', 'adapter', 'layout', 'runtime', 'verification'].includes(category))
  assert(rules.split(' ').every((rule) => /^S(?:0[1-9]|1[0-9])$/.test(rule)))
  component.decision = { category, disposition, rules: rules.split(' ') }
}
fs.writeFileSync(path.join(outputRoot, outputPath), `${JSON.stringify(output, null, 2)}\n`)
const escapeCell = (value) => value.replaceAll('|', '\\|').replaceAll('\n', ' ')
const catalog = [
  '# Desktop application component catalog',
  '',
  `Generated from source revision \`${startingRevision}\` on 2026-10-01. Every one of ${applicationComponents.length} non-registry TSX files has a reviewed disposition. The [audit](2026-10-01-component-system-audit.md) explains findings and reuse decisions. The [contract](2026-10-01-component-styling-contract.md) defines rule identifiers. The [registry audit](2026-10-01-shadcn-component-provenance.md) accounts for all 58 ui sources separately.`,
  '',
  'The symbol list includes local capitalized functions and public exports, including types and helpers. It is not a count of rendered React components. A story reference means a source import exists, not that Light/Dark, behavior, or accessibility coverage passed. The machine inventory records every JSX site, static utility string, inline style, import, and source hash.',
  '',
  '## Application files',
  '',
  '| Source and evidence | Symbols | Classification and target | Rules | Direct app / story importers |',
  '| --- | --- | --- | --- | --- |',
]
for (const component of applicationComponents) {
  const relative = component.file.slice(sourceRoot.length + 1)
  const evidenceLine = component.overrideSites[0]?.line ?? component.utilityStrings[0]?.line ?? component.components[0]?.line ?? 1
  const symbols = [...new Set([...component.components.map((entry) => entry.name), ...component.exports.map((entry) => entry.name)])].map((name) => `\`${name}\``).join(', ') || 'Entry or adapter'
  const appConsumers = component.consumers.filter((entry) => !entry.verification).length
  catalog.push(`| [${relative}](${path.join(root, component.file)}:${evidenceLine}) | ${escapeCell(symbols)} | ${component.decision.category}: ${escapeCell(component.decision.disposition)} | ${component.decision.rules.join(', ')} | ${appConsumers} / ${component.storyImporters.length} |`)
}
catalog.push('', '## Duplicate groups', '', 'Every static cross-file duplicate group follows. Equal layout utilities do not require a shared component. The audit classifies extraction candidates separately.', '', '| Static class string | Source sites |', '| --- | --- |')
for (const group of duplicates) catalog.push(`| \`${escapeCell(group.normalized)}\` | ${group.occurrences.map((entry) => `[${entry.file.slice(sourceRoot.length + 1)}:${entry.line}](${path.join(root, entry.file)}:${entry.line})`).join(', ')} |`)
fs.writeFileSync(path.join(outputRoot, 'docs/research/2026-10-01-component-catalog.md'), `${catalog.join('\n')}\n`)
console.log(JSON.stringify(output.summary, null, 2))
