import { watch } from 'node:fs'

export function watchVendorHistory(
  directory: string,
  nativeId: string,
  invalidate: () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    const watcher = watch(directory, { recursive: true }, (_event, filename) => {
      if (filename !== null && !String(filename).includes(nativeId)) return
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(invalidate, 250)
    })
    watcher.on('error', (error) => {
      console.warn('Vendor history watcher stopped:', error)
      watcher.close()
    })
    return () => {
      if (timer !== null) clearTimeout(timer)
      watcher.close()
    }
  } catch (error) {
    console.warn('Vendor history watcher unavailable:', error)
    return () => {}
  }
}
