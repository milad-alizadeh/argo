#!/usr/bin/env node
// Usage: bun scripts/move-ts-path.mts <source> <destination>
//
// Limits: rewrites only files ts-morph parses as TypeScript/TSX. A non-TS file in a moved
// folder is relocated with no rewrite of its content; a comment, string literal, or doc naming
// the old path in prose stays as-is — grep for those after the move.
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { ModuleResolutionKind, Project, ScriptTarget, ts } from 'ts-morph'
import {
  buildAliasMappings,
  readPathAliases,
  rewriteAliasSpecifiers,
  toAliasSpecifier,
} from './move-ts-path-aliases.mts'

function findPackageRoot(startPath: string): string {
  let directory = statSync(startPath).isDirectory() ? startPath : path.dirname(startPath)
  while (!existsSync(path.join(directory, 'package.json'))) {
    const parent = path.dirname(directory)
    if (parent === directory) {
      throw new Error(`No package.json found above ${startPath}`)
    }
    directory = parent
  }
  return directory
}

function isMovedFile(filePath: string): boolean {
  return /\.(ts|tsx)$/.test(filePath)
}

function stripExtension(filePath: string): string {
  return path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)))
}

// Relocates whatever ts-morph left behind: files it does not parse as TS/TSX source.
function sweepRemainingFiles(sourceDirectory: string, destinationDirectory: string): void {
  if (!existsSync(sourceDirectory)) {
    return
  }
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name)
    const destinationPath = path.join(destinationDirectory, entry.name)
    if (entry.isDirectory()) {
      sweepRemainingFiles(sourcePath, destinationPath)
      if (readdirSync(sourcePath).length === 0) {
        rmdirSync(sourcePath)
      }
    } else if (!isMovedFile(sourcePath)) {
      mkdirSync(destinationDirectory, { recursive: true })
      renameSync(sourcePath, destinationPath)
    }
  }
  if (existsSync(sourceDirectory) && readdirSync(sourceDirectory).length === 0) {
    rmdirSync(sourceDirectory)
  }
}

function buildProject(
  packageRoot: string,
  baseUrl: string,
  paths: Record<string, string[]>,
): Project {
  const project = new Project({
    compilerOptions: {
      baseUrl,
      paths,
      target: ScriptTarget.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: false,
    },
    skipAddingFilesFromTsConfig: true,
  })
  project.addSourceFilesAtPaths([
    path.join(packageRoot, '**/*.{ts,tsx}'),
    `!${path.join(packageRoot, '**/node_modules/**')}`,
    `!${path.join(packageRoot, '**/dist/**')}`,
  ])
  return project
}

type PathMove = { sourcePath: string; destinationPath: string; isDirectory: boolean }
type PathAliases = { baseUrl: string; paths: Record<string, string[]> }

// An import specifier never carries the file extension ("@/x/foo", not "@/x/foo.ts"), so a
// single-file move must strip it before matching; a directory has none to strip.
function rewriteAliasesForMove(project: Project, move: PathMove, aliases: PathAliases): void {
  const { sourcePath, destinationPath, isDirectory } = move
  const aliasMappings = buildAliasMappings(aliases.baseUrl, aliases.paths)
  const oldAliasPath = toAliasSpecifier(
    isDirectory ? sourcePath : stripExtension(sourcePath),
    aliasMappings,
  )
  const newAliasPath = toAliasSpecifier(
    isDirectory ? destinationPath : stripExtension(destinationPath),
    aliasMappings,
  )
  if (oldAliasPath && newAliasPath) {
    rewriteAliasSpecifiers(project, oldAliasPath, newAliasPath)
  }
}

async function main(): Promise<void> {
  const [sourceArgument, destinationArgument] = process.argv.slice(2)
  if (!sourceArgument || !destinationArgument) {
    console.error('Usage: bun scripts/move-ts-path.mts <source> <destination>')
    process.exit(1)
  }
  const sourcePath = path.resolve(sourceArgument)
  const destinationPath = path.resolve(destinationArgument)
  if (!existsSync(sourcePath)) {
    console.error(`Source does not exist: ${sourcePath}`)
    process.exit(1)
  }

  const packageRoot = findPackageRoot(sourcePath)
  const pathAliases = readPathAliases(packageRoot)
  const project = buildProject(packageRoot, pathAliases.baseUrl, pathAliases.paths)
  const isDirectory = statSync(sourcePath).isDirectory()
  rewriteAliasesForMove(project, { sourcePath, destinationPath, isDirectory }, pathAliases)

  if (isDirectory) {
    project.getDirectoryOrThrow(sourcePath).move(destinationPath)
  } else {
    mkdirSync(path.dirname(destinationPath), { recursive: true })
    project.getSourceFileOrThrow(sourcePath).move(destinationPath)
  }

  const changedFiles = project
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isSaved())
    .map((sourceFile) => sourceFile.getFilePath())
  await project.save()

  if (isDirectory) {
    sweepRemainingFiles(sourcePath, destinationPath)
  }

  console.log(`Moved ${sourceArgument} -> ${destinationArgument}`)
  console.log(`Rewrote ${changedFiles.length} file(s):`)
  for (const filePath of changedFiles) {
    console.log(`  ${path.relative(packageRoot, filePath)}`)
  }
}

await main()
