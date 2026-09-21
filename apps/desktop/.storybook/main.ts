import path from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'

const config: StorybookConfig = {
  stories: [
    '../src/renderer/**/*.stories.@(ts|tsx|js|jsx)',
    '../src/platform/renderer/**/*.stories.@(ts|tsx|js|jsx)',
    '../src/domains/*/renderer/**/*.stories.@(ts|tsx|js|jsx)',
  ],
  addons: ['@storybook/addon-vitest'],
  framework: { name: '@storybook/react-vite', options: {} },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
    resolve: {
      ...viteConfig.resolve,
      dedupe: [
        'react',
        'react-dom',
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
      ],
      alias: [
        { find: '@', replacement: path.resolve(import.meta.dirname, '../src') },
        {
          find: /^cn$/,
          replacement: path.resolve(import.meta.dirname, '../src/platform/renderer/lib/utils.ts'),
        },
      ],
    },
  }),
}

export default config
