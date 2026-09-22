// ts-morph's own move rewrites relative import specifiers, never path-aliased ones.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Project, StringLiteral } from 'ts-morph'
import { SyntaxKind, ts } from 'ts-morph'

// Reads compiler path aliases from a package's tsconfig.json, following one level of
// `references` for a solution file (like apps/desktop/tsconfig.json) that declares none itself.
export function readPathAliases(packageRoot: string): {
  baseUrl: string
  paths: Record<string, string[]>
} {
  const configPath = path.join(packageRoot, 'tsconfig.json')
  if (!existsSync(configPath)) {
    return { baseUrl: packageRoot, paths: {} }
  }
  const config = readJsonConfig(configPath)
  const paths: Record<string, string[]> = { ...config.compilerOptions?.paths }
  for (const reference of config.references ?? []) {
    const referencedPath = path.join(packageRoot, reference.path)
    const referenced = readJsonConfig(referencedPath)
    Object.assign(paths, referenced.compilerOptions?.paths)
  }
  return { baseUrl: packageRoot, paths }
}

// tsconfig.json here carries comments (JSONC), so a plain JSON.parse rejects it.
function readJsonConfig(configPath: string): {
  compilerOptions?: { paths?: Record<string, string[]> }
  references?: Array<{ path: string }>
} {
  return ts.readConfigFile(configPath, (filePath) => readFileSync(filePath, 'utf8')).config
}

type AliasMapping = { aliasPrefix: string; targetAbsolutePrefix: string }

// Only single-wildcard patterns ("@/*": ["./src/*"]) are supported; an exact-match alias with
// no wildcard is left alone.
export function buildAliasMappings(
  baseUrl: string,
  paths: Record<string, string[]>,
): AliasMapping[] {
  const mappings: AliasMapping[] = []
  for (const [key, targets] of Object.entries(paths)) {
    const target = targets[0]
    if (!(key.endsWith('/*') && target?.endsWith('/*'))) {
      continue
    }
    mappings.push({
      aliasPrefix: key.slice(0, -'/*'.length),
      targetAbsolutePrefix: path.resolve(baseUrl, target.slice(0, -'/*'.length)),
    })
  }
  return mappings
}

export function toAliasSpecifier(
  absolutePath: string,
  mappings: AliasMapping[],
): string | undefined {
  for (const mapping of mappings) {
    if (absolutePath.startsWith(mapping.targetAbsolutePrefix)) {
      return mapping.aliasPrefix + absolutePath.slice(mapping.targetAbsolutePrefix.length)
    }
  }
  return undefined
}

function rewrittenSpecifier(
  specifier: string,
  oldAliasPath: string,
  newAliasPath: string,
): string | undefined {
  if (specifier === oldAliasPath) {
    return newAliasPath
  }
  if (specifier.startsWith(`${oldAliasPath}/`)) {
    return newAliasPath + specifier.slice(oldAliasPath.length)
  }
  return undefined
}

// ts-morph does not surface a dynamic import() call's string argument through
// getImportDeclarations(), so it is walked separately as a CallExpression on the `import` keyword.
function rewriteDynamicImports(project: Project, oldAliasPath: string, newAliasPath: string): void {
  for (const sourceFile of project.getSourceFiles()) {
    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (callExpression.getExpression().getKind() !== SyntaxKind.ImportKeyword) {
        continue
      }
      const [argument] = callExpression.getArguments()
      if (argument?.getKind() !== SyntaxKind.StringLiteral) {
        continue
      }
      const literal = argument as StringLiteral
      const rewritten = rewrittenSpecifier(literal.getLiteralValue(), oldAliasPath, newAliasPath)
      if (rewritten) {
        literal.setLiteralValue(rewritten)
      }
    }
  }
}

// Rewrites every import/export specifier in the project that names `oldAliasPath`, directly or
// as a prefix, to `newAliasPath`. Run before the physical move: it matches on specifier text, not
// on resolved file position, so file order does not matter.
export function rewriteAliasSpecifiers(
  project: Project,
  oldAliasPath: string,
  newAliasPath: string,
): void {
  for (const sourceFile of project.getSourceFiles()) {
    const declarations = [
      ...sourceFile.getImportDeclarations(),
      ...sourceFile.getExportDeclarations(),
    ]
    for (const declaration of declarations) {
      const specifier = declaration.getModuleSpecifierValue()
      const rewritten = specifier && rewrittenSpecifier(specifier, oldAliasPath, newAliasPath)
      if (rewritten) {
        declaration.setModuleSpecifier(rewritten)
      }
    }
  }
  rewriteDynamicImports(project, oldAliasPath, newAliasPath)
}
