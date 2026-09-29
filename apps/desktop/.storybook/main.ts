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
      // Inlined, not imported from vite-alias.ts. Storybook prints on that extensionless
      // import, and the print lands in the Vitest JSON the test gate parses.
      alias: [
        {
          find: /^@\/mocks\/(.*)$/,
          replacement: `${path.resolve(import.meta.dirname, '../mocks')}/$1`,
        },
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
