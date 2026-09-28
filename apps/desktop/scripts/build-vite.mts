// Writes the production Vite output that `electron-forge package` writes, without packaging it, so
// the local e2e run launches `.vite/build/main.js` with the Electron in node_modules (#2844).
import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { build } from 'vite'
import { VITE_PLUGIN_CONFIG } from './vite-targets.mts'

// The generator is Forge's CommonJS default export, which an ESM import wraps a second time.
const { default: ViteConfigGenerator } = createRequire(import.meta.url)(
  '@electron-forge/plugin-vite/dist/ViteConfig',
) as typeof import('@electron-forge/plugin-vite/dist/ViteConfig.js')

const projectDirectory = path.resolve(import.meta.dirname, '..')
const generator = new ViteConfigGenerator(VITE_PLUGIN_CONFIG, projectDirectory, true)
const configs = [...(await generator.getBuildConfigs()), ...(await generator.getRendererConfig())]

await rm(path.join(projectDirectory, '.vite'), { recursive: true, force: true })
// Forge's prePackage hook builds each target with these same two options.
for (const config of configs) await build({ configFile: false, logLevel: 'warn', ...config })
