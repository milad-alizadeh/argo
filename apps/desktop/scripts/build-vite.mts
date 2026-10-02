// Writes the production Vite output that `electron-forge package` writes, without packaging it, so
// the local e2e run launches `.vite/build/main.js` with the Electron in node_modules (#2844).
// `--watch` keeps running and rebuilds only the targets whose files change (#3149).
import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer, type Server } from 'node:net'
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

// At most two builds run on the machine at once. A slot is a listening port, so the OS frees it
// when the build process exits, however it exits.
const BUILD_SLOT_PORTS = [47_591, 47_592]

function listen(port: number): Promise<Server | undefined> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(undefined))
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => resolve(server))
  })
}

async function takeBuildSlot(): Promise<Server> {
  for (let attempt = 0; ; attempt++) {
    for (const port of BUILD_SLOT_PORTS) {
      const slot = await listen(port)
      if (slot) return slot
    }
    if (attempt === 0)
      console.log(`Waiting for a build slot (ports ${BUILD_SLOT_PORTS.join(', ')})`)
    await sleep(2_000)
  }
}

const slot = await takeBuildSlot()
await rm(path.join(projectDirectory, '.vite'), { recursive: true, force: true })
const firstBuilds: Promise<unknown>[] = []
// Forge's prePackage hook builds each target with these same two options.
for (const config of configs) {
  const result = await build({
    configFile: false,
    // Watch mode logs each rebuild, so a reader knows when to run `playwright test`.
    logLevel: watch ? 'info' : 'warn',
    ...config,
    build: { ...config.build, ...(watch ? { watch: {} } : {}) },
  })
  // A watcher returns at once; its first build ends at the first END or ERROR event.
  if ('on' in result) {
    firstBuilds.push(
      new Promise((resolve) =>
        result.on('event', (event) => {
          if (event.code === 'END' || event.code === 'ERROR') resolve(undefined)
        }),
      ),
    )
  }
}
await Promise.all(firstBuilds)
slot.close()
