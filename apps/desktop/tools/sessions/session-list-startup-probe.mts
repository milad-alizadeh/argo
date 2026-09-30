// Bundled to CJS and prepended to the Vite main entry for startup measurement.
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { monitorEventLoopDelay } from 'node:perf_hooks'

type Probe = {
  syncReads: number
  syncReadBytes: number
  syncDirectoryReads: number
  syncStats: number
  asyncReads: number
  asyncReadBytes: number
  watcherStarts: number
  activeWatchers: number
  delay: ReturnType<typeof monitorEventLoopDelay>
}

declare global {
  // The driver reads this from the Electron main process.
  var __argoSessionListProbe: Probe | undefined
}

if (process.versions.electron && process.type !== 'renderer') {
  const roots = (process.env.ARGO_SESSION_LIST_CORPUS_ROOTS ?? '')
    .split(pathDelimiter())
    .filter(Boolean)
  const inCorpus = (value: unknown) =>
    typeof value === 'string' && roots.some((root) => value.startsWith(root))
  const delay = monitorEventLoopDelay({ resolution: 20 })
  delay.enable()
  const probe: Probe = {
    syncReads: 0,
    syncReadBytes: 0,
    syncDirectoryReads: 0,
    syncStats: 0,
    asyncReads: 0,
    asyncReadBytes: 0,
    watcherStarts: 0,
    activeWatchers: 0,
    delay,
  }
  globalThis.__argoSessionListProbe = probe
  const descriptors = new Map<number, string>()
  const readFileSync = fs.readFileSync
  fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    const result = readFileSync(...args)
    if (inCorpus(args[0])) {
      probe.syncReads += 1
      probe.syncReadBytes += Buffer.byteLength(result)
    }
    return result
  }) as typeof fs.readFileSync
  const openSync = fs.openSync
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    const descriptor = openSync(...args)
    if (inCorpus(args[0])) descriptors.set(descriptor, String(args[0]))
    return descriptor
  }) as typeof fs.openSync
  const readSync = fs.readSync
  fs.readSync = ((...args: Parameters<typeof fs.readSync>) => {
    const bytes = readSync(...args)
    if (descriptors.has(args[0])) {
      probe.syncReads += 1
      probe.syncReadBytes += bytes
    }
    return bytes
  }) as typeof fs.readSync
  const closeSync = fs.closeSync
  fs.closeSync = ((...args: Parameters<typeof fs.closeSync>) => {
    descriptors.delete(args[0])
    return closeSync(...args)
  }) as typeof fs.closeSync
  const readdirSync = fs.readdirSync
  fs.readdirSync = ((...args: Parameters<typeof fs.readdirSync>) => {
    if (inCorpus(args[0])) probe.syncDirectoryReads += 1
    return readdirSync(...args)
  }) as typeof fs.readdirSync
  const statSync = fs.statSync
  ;(fs as { statSync: typeof fs.statSync }).statSync = ((
    ...args: Parameters<typeof fs.statSync>
  ) => {
    if (inCorpus(args[0])) probe.syncStats += 1
    return statSync(...args)
  }) as typeof fs.statSync
  const watch = fs.watch
  fs.watch = ((...args: Parameters<typeof fs.watch>) => {
    const watcher = watch(...args)
    probe.watcherStarts += 1
    probe.activeWatchers += 1
    const close = watcher.close.bind(watcher)
    let closed = false
    watcher.close = () => {
      if (!closed) probe.activeWatchers -= 1
      closed = true
      close()
    }
    return watcher
  }) as typeof fs.watch
  const readFile = fs.promises.readFile.bind(fs.promises)
  fs.promises.readFile = (async (...args: Parameters<typeof fs.promises.readFile>) => {
    const result = await readFile(...args)
    if (inCorpus(args[0])) {
      probe.asyncReads += 1
      probe.asyncReadBytes += Buffer.byteLength(result)
    }
    return result
  }) as typeof fs.promises.readFile
  syncBuiltinESMExports()
}

function pathDelimiter() {
  return process.platform === 'win32' ? ';' : ':'
}
