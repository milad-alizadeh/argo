import path from 'node:path'
import type { Alias } from 'vite'

// `@/mocks/…` stays ahead of `@`, which would otherwise resolve it under `src/`.
export function desktopAlias(directory: string): Alias[] {
  return [
    {
      find: /^@\/mocks\/(.*)$/,
      replacement: `${path.resolve(directory, 'mocks')}/$1`,
    },
    { find: '@', replacement: path.resolve(directory, 'src') },
  ]
}
