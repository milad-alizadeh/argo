import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Command } from './migration-ratchet.mts'

export type GateName = 'types' | 'boundaries' | 'tests' | 'storybook'
export type ParserConfiguration =
  | { kind: 'typescript'; workspace: string }
  | { kind: 'boundaries' }
  | { kind: 'bun-tests'; project: string }
  | { kind: 'vitest'; project: string }
  | { kind: 'storybook' }
export type GateCommand = Command & {
  label: string
  parser?: ParserConfiguration
  failuresExitZero?: boolean
}

const directory = path.dirname(fileURLToPath(import.meta.url))
export const repositoryRoot = path.resolve(directory, '..', '..')
export const desktopRoot = path.join(repositoryRoot, 'apps', 'desktop')
const fiveMinutes = 5 * 60 * 1_000

const tsc = (label: string, project: string, workspace: string): GateCommand => ({
  label,
  executable: 'bunx',
  args: ['tsc', '--noEmit', '-p', project, '--pretty', 'false'],
  cwd: repositoryRoot,
  timeoutMilliseconds: fiveMinutes,
  parser: { kind: 'typescript', workspace },
})

export const gateCommands: Record<GateName, GateCommand[]> = {
  types: [
    tsc('desktop node types', 'apps/desktop/tsconfig.node.json', '@argo/desktop'),
    tsc('desktop renderer types', 'apps/desktop/tsconfig.web.json', '@argo/desktop'),
    tsc('desktop e2e types', 'apps/desktop/tsconfig.e2e.json', '@argo/desktop'),
    tsc('Codex transport types', 'prototypes/codex-transport/tsconfig.json', 'codex-transport'),
    tsc('repository script types', 'tsconfig.scripts.json', 'scripts'),
  ],
  boundaries: [
    {
      label: 'dependency boundaries',
      executable: 'bunx',
      args: [
        'depcruise',
        '--config',
        '.dependency-cruiser.json',
        '--output-type',
        'json',
        'apps/desktop/src',
        'apps/desktop/mocks',
        'apps/desktop/e2e',
      ],
      cwd: repositoryRoot,
      timeoutMilliseconds: fiveMinutes,
      parser: { kind: 'boundaries' },
      failuresExitZero: true,
    },
  ],
  tests: [
    {
      label: 'desktop Bun tests',
      executable: 'bun',
      args: ['test'],
      cwd: desktopRoot,
      timeoutMilliseconds: fiveMinutes,
      parser: { kind: 'bun-tests', project: '@argo/desktop' },
    },
    {
      label: 'desktop Node Vitest tests',
      executable: 'bunx',
      args: ['vitest', 'run', '--project=node', '--reporter=json'],
      cwd: desktopRoot,
      timeoutMilliseconds: fiveMinutes,
      parser: { kind: 'vitest', project: '@argo/desktop:node' },
    },
    {
      label: 'Codex transport Node tests',
      executable: 'node',
      args: ['--test', 'prototypes/codex-transport/channel.test.ts'],
      cwd: repositoryRoot,
      timeoutMilliseconds: fiveMinutes,
    },
  ],
  storybook: [
    {
      label: 'Storybook interaction tests',
      executable: 'bunx',
      args: ['vitest', 'run', '--project=storybook', '--no-file-parallelism'],
      cwd: desktopRoot,
      timeoutMilliseconds: 10 * 60 * 1_000,
      parser: { kind: 'storybook' },
    },
  ],
}
