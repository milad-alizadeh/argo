// Bundled to CJS and prepended to the Vite main entry for startup measurement.
import childProcess from 'node:child_process'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { DatabaseSync, StatementSync } from 'node:sqlite'
import { promisify } from 'node:util'

// A count of calls and their summed and longest time, keyed by what was called.
export type Timings = Record<string, { count: number; totalMs: number; maxMs: number }>

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
  // Opens and bytes of each corpus file, by path.
  files: Record<string, { opens: number; bytes: number }>
  // Child processes main started, by program and first argument.
  spawns: Timings
  // SQLite statements main ran, by SQL text.
  sql: Timings
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
    files: {},
    spawns: {},
    sql: {},
  }
  globalThis.__argoSessionListProbe = probe
  const time = (timings: Timings, key: string, started: number) => {
    const elapsed = performance.now() - started
    timings[key] ??= { count: 0, totalMs: 0, maxMs: 0 }
    const timing = timings[key]
    timing.count += 1
    timing.totalMs += elapsed
    timing.maxMs = Math.max(timing.maxMs, elapsed)
  }
  const fileRead = (file: unknown, bytes: number, opened: boolean) => {
    if (!inCorpus(file)) return
    const key = String(file)
    probe.files[key] ??= { opens: 0, bytes: 0 }
    probe.files[key].opens += opened ? 1 : 0
    probe.files[key].bytes += bytes
  }
  const descriptors = new Map<number, string>()
  const readFileSync = fs.readFileSync
  fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    const result = readFileSync(...args)
    if (inCorpus(args[0])) {
      probe.syncReads += 1
      probe.syncReadBytes += Buffer.byteLength(result)
    }
    fileRead(args[0], Buffer.byteLength(result), true)
    return result
  }) as typeof fs.readFileSync
  const openSync = fs.openSync
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    const descriptor = openSync(...args)
    if (inCorpus(args[0])) descriptors.set(descriptor, String(args[0]))
    fileRead(args[0], 0, true)
    return descriptor
  }) as typeof fs.openSync
  const readSync = fs.readSync
  fs.readSync = ((...args: Parameters<typeof fs.readSync>) => {
    const bytes = readSync(...args)
    if (descriptors.has(args[0])) {
      probe.syncReads += 1
      probe.syncReadBytes += bytes
      fileRead(descriptors.get(args[0]), bytes, false)
    }
    return bytes
  }) as typeof fs.readSync
  const createReadStream = fs.createReadStream
  fs.createReadStream = ((...args: Parameters<typeof fs.createReadStream>) => {
    const stream = createReadStream(...args)
    if (inCorpus(args[0])) {
      fileRead(args[0], 0, true)
      stream.on('data', (chunk) => fileRead(args[0], Buffer.byteLength(chunk), false))
    }
    return stream
  }) as typeof fs.createReadStream
  const open = fs.promises.open.bind(fs.promises)
  fs.promises.open = (async (...args: Parameters<typeof fs.promises.open>) => {
    const handle = await open(...args)
    if (!inCorpus(args[0])) return handle
    fileRead(args[0], 0, true)
    const read = handle.read.bind(handle) as (
      ...values: unknown[]
    ) => Promise<fs.promises.FileReadResult<NodeJS.ArrayBufferView>>
    handle.read = (async (...values: unknown[]) => {
      const result = await read(...values)
      fileRead(args[0], result.bytesRead, false)
      return result
    }) as typeof handle.read
    const readWhole = handle.readFile.bind(handle)
    handle.readFile = (async (...values: Parameters<typeof handle.readFile>) => {
      const result = await readWhole(...values)
      fileRead(args[0], Buffer.byteLength(result), false)
      return result
    }) as typeof handle.readFile
    return handle
  }) as typeof fs.promises.open
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
    fileRead(args[0], Buffer.byteLength(result), true)
    return result
  }) as typeof fs.promises.readFile
  // execFile keeps its promisified form, so a caller's `promisify(execFile)` still gets stdout.
  const execFile = childProcess.execFile
  const spawnKey = (file: unknown, args: unknown) =>
    `${path.basename(String(file))} ${Array.isArray(args) ? String(args[0] ?? '') : ''}`.trim()
  const timedExecFile = ((...args: unknown[]) => {
    const started = performance.now()
    const key = spawnKey(args[0], args[1])
    const callback = args.findLastIndex((value) => typeof value === 'function')
    if (callback >= 0) {
      const done = args[callback] as (...results: unknown[]) => void
      args[callback] = (...results: unknown[]) => {
        time(probe.spawns, key, started)
        done(...results)
      }
    }
    return (execFile as (...values: unknown[]) => unknown)(...args)
  }) as typeof childProcess.execFile
  const promised = promisify(execFile)
  Object.defineProperty(timedExecFile, promisify.custom, {
    value: async (...args: Parameters<typeof promised>) => {
      const started = performance.now()
      try {
        return await promised(...args)
      } finally {
        time(probe.spawns, spawnKey(args[0], args[1]), started)
      }
    },
  })
  childProcess.execFile = timedExecFile
  const statement = StatementSync.prototype as unknown as Record<string, unknown>
  for (const method of ['all', 'get', 'run', 'iterate']) {
    const original = statement[method] as (...args: unknown[]) => unknown
    statement[method] = function (this: { sourceSQL: string }, ...args: unknown[]) {
      const started = performance.now()
      try {
        return original.apply(this, args)
      } finally {
        time(probe.sql, this.sourceSQL, started)
      }
    }
  }
  const database = DatabaseSync.prototype as unknown as Record<string, unknown>
  const exec = database.exec as (sql: string) => unknown
  database.exec = function (this: unknown, sql: string) {
    const started = performance.now()
    try {
      return exec.call(this, sql)
    } finally {
      time(probe.sql, sql, started)
    }
  }
  syncBuiltinESMExports()
}

function pathDelimiter() {
  return process.platform === 'win32' ? ';' : ':'
}
