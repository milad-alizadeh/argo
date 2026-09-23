// A mock CLI fixture (mock-codex-app-server.ts, mock-claude.ts) is spawned as a real child process
// by plain `node`, never bundled, so nothing resolves its `@/` import on its own. Passed to that
// spawn as `--import`, this file registers itself as a resolution hook before the fixture loads,
// rewriting `@/` to this repo's own `src/` the same way tsconfig's `paths` does for tooling that
// reads it. Shared by every mock CLI under `mocks/cli/`, so the hook is written once.
import { register } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC_ROOT = pathToFileURL(
  `${path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src')}/`,
).href

type ResolveContext = { parentURL?: string }

export async function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: (specifier: string, context: unknown) => unknown,
) {
  if (specifier.startsWith('@/')) {
    const rest = specifier.slice(2)
    // Node's ESM resolver adds no extension on its own, unlike the bundler `@/` stands in for.
    const withExtension = path.extname(rest) === '' ? `${rest}.ts` : rest
    return nextResolve(`${SRC_ROOT}${withExtension}`, context)
  }
  // A `src/` file's own relative import carries no extension, same as its `@/` imports: the
  // bundler every other reader of `src/` uses adds one, so a file this hook pulls in for a mock
  // needs the same treatment for the imports it makes of its own, not just the one this hook
  // rewrote to reach it.
  const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
  const fromSrc = context.parentURL?.startsWith(SRC_ROOT) === true
  if (isRelative && fromSrc && path.extname(specifier) === '') {
    return nextResolve(`${specifier}.ts`, context)
  }
  return nextResolve(specifier, context)
}

register(pathToFileURL(fileURLToPath(import.meta.url)).href)
