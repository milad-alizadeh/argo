import type { VitePluginConfig } from '@electron-forge/plugin-vite/dist/Config.js'

// Read by `forge.config.ts` and by `build-vite.mts`, which writes the same output unpackaged.
export const VITE_PLUGIN_CONFIG: VitePluginConfig = {
  // Both targets emit into .vite/build, and the output is named after the entry file. Two
  // entries both called index.ts silently overwrite each other, so the entry basenames are
  // the contract with `main` in package.json and the preload path in create-window.ts.
  build: [
    { entry: 'src/main.ts', config: 'vite.main.config.ts', target: 'main' },
    { entry: 'src/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
  ],
  renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }],
}
