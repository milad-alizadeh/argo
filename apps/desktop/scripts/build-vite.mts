// Writes the production Vite output that `electron-forge package` writes, without packaging it, so
// the local e2e run launches `.vite/build/main.js` with the Electron in node_modules (#2844).
// `--watch` keeps running and rebuilds only the targets whose files change (#3149).
import { readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { build } from 'vite'
import { VITE_PLUGIN_CONFIG } from './vite-targets.mts'

// The generator is Forge's CommonJS default export, which an ESM import wraps a second time.
const { default: ViteConfigGenerator } = createRequire(import.meta.url)(
  '@electron-forge/plugin-vite/dist/ViteConfig',
) as typeof import('@electron-forge/plugin-vite/dist/ViteConfig.js')

const watch = process.argv.includes('--watch')
const projectDirectory = path.resolve(import.meta.dirname, '..')
const generator = new ViteConfigGenerator(VITE_PLUGIN_CONFIG, projectDirectory, true)
const configs = [...(await generator.getBuildConfigs()), ...(await generator.getRendererConfig())]

// At most two one-shot builds run on the machine at once; a slot whose process is gone is freed.
const buildSlots = [1, 2].map((slot) => path.join(tmpdir(), `argo-vite-build-${slot}.pid`))

function isRunning(processId: number): boolean {
  try {
    process.kill(processId, 0)
    return true
  } catch {
    return false
  }
}

async function takeBuildSlot(): Promise<string> {
  for (;;) {
    for (const slot of buildSlots) {
      try {
        await writeFile(slot, String(process.pid), { flag: 'wx' })
        return slot
      } catch {
        const owner = Number(await readFile(slot, 'utf8').catch(() => ''))
        if (owner > 0 && !isRunning(owner)) await rm(slot, { force: true })
      }
    }
    await sleep(2_000)
  }
}

const slot = watch ? undefined : await takeBuildSlot()
try {
  await rm(path.join(projectDirectory, '.vite'), { recursive: true, force: true })
  // Forge's prePackage hook builds each target with these same two options.
  for (const config of configs) {
    await build({
      configFile: false,
      // Watch mode logs each rebuild, so a reader knows when to run `playwright test`.
      logLevel: watch ? 'info' : 'warn',
      ...config,
      build: { ...config.build, ...(watch ? { watch: {} } : {}) },
    })
  }
} finally {
  if (slot) await rm(slot, { force: true })
}
