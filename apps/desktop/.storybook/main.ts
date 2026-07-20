import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

/**
 * Resolve the absolute path of a package. Needed in projects that use Yarn PnP
 * or are set up within a monorepo.
 */
function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}

const projectRoot = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@chromatic-com/storybook'),
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-mcp'),
  ],
  framework: getAbsolutePath('@storybook/react-vite') as '@storybook/react-vite',
  // Storybook runs its own Vite (not electron-vite), so re-declare what our renderer
  // components rely on: Tailwind 4 and the "@" / "@shared" aliases.
  viteFinal: async (viteConfig) => {
    const { default: tailwindcss } = await import('@tailwindcss/vite')
    const { mergeConfig } = await import('vite')
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@': resolve(projectRoot, '../src/renderer/src'),
          '@renderer': resolve(projectRoot, '../src/renderer/src'),
          '@shared': resolve(projectRoot, '../src/shared/index.ts'),
        },
      },
    })
  },
}
export default config
