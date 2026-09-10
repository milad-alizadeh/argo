import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves this repository's site from `/argo/`, not from the domain root, so every
// asset URL the build writes has to carry that prefix (#1910). `storybook build` has no flag for
// it; Vite's `base` is the setting, and it is read from the environment so that a local
// `storybook dev` and a local build still serve from `/`.
const base = process.env.STORYBOOK_BASE ?? '/'

const config: StorybookConfig = {
  stories: ['../src/renderer/**/*.stories.@(ts|tsx|js|jsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    base,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
  }),
}

export default config
