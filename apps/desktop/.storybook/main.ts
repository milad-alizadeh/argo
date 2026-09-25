import path from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'

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
