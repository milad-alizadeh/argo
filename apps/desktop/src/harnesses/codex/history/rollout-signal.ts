import { watch } from 'node:fs'

const ROLLOUT_ID = /([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.jsonl$/i

// The filename is the invalidation signal. The file body is not history (#2581).
export function threadIdFromRolloutSignal(filename: string | null): string | null {
  if (filename === null) return null
  const base = filename.split(/[\\/]/u).at(-1) ?? filename
  return base.match(ROLLOUT_ID)?.[1] ?? null
}

export function createRolloutInvalidation(options: {
  subscribe: (onFilename: (filename: string | null) => void) => () => void
  readThread: (threadId: string) => Promise<void>
  readAll: () => Promise<void>
}): () => void {
  return options.subscribe((filename) => {
    const threadId = threadIdFromRolloutSignal(filename)
    const read =
      threadId === null
        ? options.readAll()
        : options.readThread(threadId).catch(() => options.readAll())
    void read.catch(() => undefined)
  })
}

export function watchRolloutSignals(
  directory: string,
  onFilename: (filename: string | null) => void,
): () => void {
  try {
    const watcher = watch(directory, { recursive: true }, (_event, filename) => {
      onFilename(typeof filename === 'string' ? filename : null)
    })
    watcher.on('error', () => undefined)
    return () => watcher.close()
  } catch {
    return () => undefined
  }
}
