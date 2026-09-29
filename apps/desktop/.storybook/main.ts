import path from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'
import { desktopAlias } from '../vite-alias'

const config: StorybookConfig = {
  stories: [
    '../src/renderer/**/*.stories.@(ts|tsx|js|jsx)',
    '../src/platform/renderer/**/*.stories.@(ts|tsx|js|jsx)',
    '../src/domains/*/renderer/**/*.stories.@(ts|tsx|js|jsx)',
  ],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
    // Keep previews mountable while an unrelated story has an unresolved application import.
    optimizeDeps: {
      ...viteConfig.optimizeDeps,
      include: [
        ...(viteConfig.optimizeDeps?.include ?? []),
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
    resolve: {
      ...viteConfig.resolve,
      dedupe: [
        'react',
        'react-dom',
        'lexical',
        '@lexical/code',
        '@lexical/link',
        '@lexical/list',
        '@lexical/markdown',
        '@lexical/react',
        '@lexical/rich-text',
        '@lexical/text',
        '@lexical/utils',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
      ],
      alias: [
        ...desktopAlias(path.resolve(import.meta.dirname, '..')),
        {
          find: /^cn$/,
          replacement: path.resolve(import.meta.dirname, '../src/platform/renderer/lib/utils.ts'),
        },
      ],
    },
  }),
}

export default config
