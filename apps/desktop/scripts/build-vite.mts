// Writes the production Vite output that `electron-forge package` writes, without packaging it, so
// the local e2e run launches `.vite/build/main.js` with the Electron in node_modules (#2844).
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

const projectDirectory = path.resolve(import.meta.dirname, '..')
const generator = new ViteConfigGenerator(VITE_PLUGIN_CONFIG, projectDirectory, true)
const configs = [...(await generator.getBuildConfigs()), ...(await generator.getRendererConfig())]

// At most two builds run on the machine at once. A slot is a listening port, so the OS frees it
// when the build process exits, however it exits.
const BUILD_SLOT_PORTS = [47_591, 47_592]

function listen(port: number): Promise<Server | undefined> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', (error: NodeJS.ErrnoException) =>
      error.code === 'EADDRINUSE' ? resolve(undefined) : reject(error),
    )
    server.listen({ port, host: '127.0.0.1' }, () => resolve(server))
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
// Forge's prePackage hook builds each target with these same two options.
for (const config of configs) await build({ configFile: false, logLevel: 'warn', ...config })
slot.close()
