import ts from 'typescript'
import { TYPOGRAPHY_RECIPES } from '../../src/platform/renderer/lib/text-sizes'

const completeRecipes = new Set(TYPOGRAPHY_RECIPES.map((role) => `type-${role}`))
const scopedAdapters = new Set(['type-code-content'])
const classFunctions = new Set(['cn', 'cva', 'clsx', 'twMerge'])
const ownerName = /class|recipe|variant|style/i

function typographyClasses(value: string): string[] {
  return value.split(/\s+/).flatMap((token) => {
    const match = token.match(/(?:^|:)!?(type-[\w-]+)!?$/)
    return match?.[1] ? [match[1]] : []
  })
}

type LocalValues = Map<ts.Node, Map<string, ts.Expression>>

function declarationScope(node: ts.Node): ts.Node {
  let scope = node.parent
  while (!ts.isSourceFile(scope) && !ts.isBlock(scope) && !ts.isFunctionLike(scope))
    scope = scope.parent
  return scope
}

function localValues(source: ts.SourceFile): LocalValues {
  const values: LocalValues = new Map()
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const scope = declarationScope(node)
      const declarations = values.get(scope) ?? new Map<string, ts.Expression>()
      declarations.set(node.name.text, node.initializer)
      values.set(scope, declarations)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return values
}

function identifierValue(node: ts.Identifier, values: LocalValues): ts.Expression | undefined {
  let scope: ts.Node | undefined = node.parent
  while (scope) {
    const value = values.get(scope)?.get(node.text)
    if (value) return value
    if (
      ts.isFunctionLike(scope) &&
      scope.parameters.some((parameter) => parameter.name.getText() === node.text)
    )
      return undefined
    scope = scope.parent
  }
  return undefined
}

function classStrings(node: ts.Node, values: LocalValues, seen = new Set<ts.Node>()): string[] {
  if (seen.has(node)) return []
  seen.add(node)
  if (ts.isStringLiteralLike(node)) return [node.text]
  if (ts.isIdentifier(node)) {
    const value = identifierValue(node, values)
    return value ? classStrings(value, values, seen) : []
  }
  if (ts.isPropertyAssignment(node)) {
    const key = ts.isStringLiteralLike(node.name) ? [node.name.text] : []
    return [...key, ...classStrings(node.initializer, values, seen)]
  }
  if (ts.isShorthandPropertyAssignment(node)) return classStrings(node.name, values, seen)
  if (
    ts.isCallExpression(node) &&
    !classFunctions.has(node.expression.getText()) &&
    !isClassContext(node)
  )
    return []
  if (ts.isConditionalExpression(node)) {
    return [
      ...classStrings(node.whenTrue, values, seen),
      ...classStrings(node.whenFalse, values, seen),
    ]
  }
  if (ts.isTemplateExpression(node)) {
    return [
      node.head.text,
      ...node.templateSpans.flatMap((span) => [
        span.literal.text,
        ...classStrings(span.expression, values, seen),
      ]),
    ]
  }
  return node.getChildren().flatMap((child) => classStrings(child, values, seen))
}

function isClassContext(node: ts.Node): boolean {
  if (ts.isJsxAttribute(node)) return ['class', 'className'].includes(node.name.getText())
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
    return ownerName.test(node.name.text)
  if (ts.isPropertyAssignment(node))
    return ['class', 'className'].includes(node.name.getText().replace(/['"]/g, ''))
  if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left))
    return node.left.name.text === 'className'
  if (!ts.isCallExpression(node)) return false
  if (classFunctions.has(node.expression.getText())) return true
  if (!ts.isPropertyAccessExpression(node.expression)) return false
  const { expression, name } = node.expression
  if (name.text === 'setAttribute') {
    const attribute = node.arguments[0]
    return attribute !== undefined && ts.isStringLiteral(attribute) && attribute.text === 'class'
  }
  return (
    expression.getText().endsWith('.classList') &&
    ['add', 'remove', 'toggle', 'replace'].includes(name.text)
  )
}

export function typescriptTypographyConsumers(source: string, filename = 'fixture.tsx'): string[] {
  const syntax = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const values = localValues(syntax)
  const classes = new Set<string>()
  function visit(node: ts.Node) {
    if (isClassContext(node)) {
      for (const value of classStrings(node, values)) {
        for (const className of typographyClasses(value)) classes.add(className)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(syntax)
  return [...classes]
}

export function cssTypographyConsumers(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const applied = [...withoutComments.matchAll(/@apply\s+([^;{}]+);/g)].flatMap((match) =>
    typographyClasses(match[1] ?? ''),
  )
  const selectors = [...withoutComments.matchAll(/(?:^|[{}])\s*([^{}]+)\{/g)].flatMap((match) =>
    [...(match[1] ?? '').matchAll(/\.(type-[\w-]+)/g)].flatMap((selector) =>
      selector[1] ? [selector[1]] : [],
    ),
  )
  const utilities = [...withoutComments.matchAll(/@utility\s+(type-[\w-]+)/g)].map(
    (match) => match[1] ?? '',
  )
  return [...new Set([...applied, ...selectors, ...utilities])]
}

export function undefinedTypographyRecipes(classes: string[]): string[] {
  return classes.filter(
    (className) => !completeRecipes.has(className) && !scopedAdapters.has(className),
  )
}

export function productionStylingOwner(path: string): boolean {
  return (
    /(?:^|\/)(?:platform\/renderer|renderer|domains\/[^/]+\/renderer|harnesses\/[^/]+\/(?:renderer|presentation))\//.test(
      path,
    ) &&
    !/\.(?:test|stories|vitest)\./.test(path) &&
    !path.endsWith('/composer-story-samples.tsx')
  )
}
