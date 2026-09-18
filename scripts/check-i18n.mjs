import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repositoryRoot = resolve(import.meta.dirname, '..')
const rendererRoots = [
  join(repositoryRoot, 'apps/desktop/src/domains'),
  join(repositoryRoot, 'apps/desktop/src/platform/renderer'),
  join(repositoryRoot, 'apps/desktop/src/renderer/modules/sessions'),
]
const accessibleAttributes = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'placeholder',
  'title',
])

function lineOf(source, position) {
  return source.getLineAndCharacterOfPosition(position).line + 1
}

function message(file, line, detail) {
  return `${file}:${line}: ${detail} must use i18n`
}

function hasReaderText(value) {
  return /[\p{L}\p{N}]/u.test(value)
}

function jsxText(value) {
  return value.replaceAll(/\s+/g, ' ').trim()
}

function textFailure(context, node) {
  const value = jsxText(node.text)
  const line = lineOf(context.source, node.getStart(context.source))
  return hasReaderText(value) && (!context.changedLines || context.changedLines.has(line))
    ? message(context.file, line, `literal text ${JSON.stringify(value)}`)
    : null
}

function attributeFailure(context, node) {
  const literal = ts.isStringLiteral(node.initializer) ? node.initializer.text : null
  const line = lineOf(context.source, node.initializer.getStart(context.source))
  return literal &&
    hasReaderText(literal) &&
    (!context.changedLines || context.changedLines.has(line))
    ? message(context.file, line, `literal ${node.name.text} ${JSON.stringify(literal)}`)
    : null
}

export function hardCodedText(input, file, changedLines) {
  const source = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const failures = []
  const context = { changedLines, file, source }

  function visit(node) {
    if (ts.isJsxText(node)) {
      const failure = textFailure(context, node)
      if (failure) {
        failures.push(failure)
      }
    }

    if (ts.isJsxAttribute(node) && node.initializer && accessibleAttributes.has(node.name.text)) {
      const failure = attributeFailure(context, node)
      if (failure) {
        failures.push(failure)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return failures
}

function changedProductionLines() {
  const diff = execFileSync(
    'git',
    ['diff', '--unified=0', '--no-color', 'origin/main', '--', ...rendererRoots],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    },
  )
  const changed = new Map()
  let file

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6)
    }
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (file && match) {
      const first = Number(match[1])
      const count = Number(match[2] ?? 1)
      const lines = changed.get(file) ?? new Set()
      for (const index of Array.from({ length: count }, (_, offset) => offset)) {
        lines.add(first + index)
      }
      changed.set(file, lines)
    }
  }
  return changed
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === 'ui' ? [] : sourceFiles(path)
    }
    return entry.name.endsWith('.tsx') &&
      !entry.name.includes('.stories.') &&
      !entry.name.includes('.test.')
      ? [path]
      : []
  })
}

function main() {
  const changed = changedProductionLines()
  const failures = rendererRoots.flatMap((root) =>
    sourceFiles(root).flatMap((path) => {
      const file = relative(repositoryRoot, path)
      return hardCodedText(readFileSync(path, 'utf8'), file, changed.get(file) ?? new Set())
    }),
  )

  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
