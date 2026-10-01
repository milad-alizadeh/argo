import { type FileHandle, open, stat } from 'node:fs/promises'
import type { TranscriptLines } from '@/harnesses/registration'

// Bytes before the read offset, compared on each read to catch a rewrite that kept the inode.
const WITNESS_BYTES = 64
const LINE_BREAK = Buffer.from('\n')

type TailPosition = {
  inode: number
  // The file size the last read saw, so an unchanged file opens nothing.
  size: number
  offset: number
  witness: Buffer
  // The offset sits inside a line, so the bytes up to the next line break are not a record.
  midLine: boolean
}

async function readRange(handle: FileHandle, start: number, end: number): Promise<Buffer> {
  const buffer = Buffer.alloc(Math.max(0, end - start))
  let read = 0
  while (read < buffer.length) {
    const { bytesRead } = await handle.read(buffer, read, buffer.length - read, start + read)
    if (bytesRead === 0) break
    read += bytesRead
  }
  return buffer.subarray(0, read)
}

// The complete non-empty lines in `bytes`, and how many bytes they span with their line breaks.
function completeLines(bytes: Buffer): { length: number; lines: string[] } {
  const end = bytes.lastIndexOf('\n')
  if (end < 0) return { length: 0, lines: [] }
  const lines = bytes
    .subarray(0, end)
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
  return { length: end + 1, lines }
}

async function withFile<T>(
  file: string,
  use: (handle: FileHandle) => Promise<T>,
): Promise<T | null> {
  let handle: FileHandle
  try {
    handle = await open(file, 'r')
  } catch {
    return null
  }
  try {
    return await use(handle)
  } finally {
    await handle.close()
  }
}

// The complete lines each file gained since its last read, with an offset per file. A partial
// last line waits for its break. A file read for the first time, truncated, rewritten, or grown
// by more than `windowBytes` reads only its last `windowBytes`, from the first whole line there.
export class AppendedTail {
  readonly #windowBytes: number
  readonly #positions = new Map<string, TailPosition>()

  constructor(windowBytes = 64 * 1024) {
    this.#windowBytes = windowBytes
  }

  has(file: string): boolean {
    return this.#positions.has(file)
  }

  // Starts a file at its current end, reading none of it.
  async mark(file: string): Promise<void> {
    await withFile(file, async (handle) => {
      const { size, ino } = await handle.stat()
      const midLine = size > 0 && !(await readRange(handle, size - 1, size)).equals(LINE_BREAK)
      await this.#remember(file, handle, { inode: ino, size, offset: size, midLine })
    })
  }

  // The lines the file gained, or null when it did not grow or is gone.
  async read(file: string): Promise<TranscriptLines | null> {
    const previous = this.#positions.get(file)
    try {
      const { size, ino } = await stat(file)
      if (previous !== undefined && previous.inode === ino && previous.size === size) return null
    } catch {
      this.#positions.delete(file)
      return null
    }
    const read = await withFile(file, (handle) => this.#read(file, handle, previous))
    if (read === null) this.#positions.delete(file)
    return read
  }

  forget(file: string): void {
    this.#positions.delete(file)
  }

  async #read(
    file: string,
    handle: FileHandle,
    previous: TailPosition | undefined,
  ): Promise<TranscriptLines> {
    const { size, ino } = await handle.stat()
    const continued =
      previous !== undefined &&
      (await this.#follows(handle, previous, { size, ino })) &&
      size - previous.offset <= this.#windowBytes
    const start = continued ? previous.offset : Math.max(0, size - this.#windowBytes)
    const midLine = continued
      ? previous.midLine
      : start > 0 && !(await readRange(handle, start - 1, start)).equals(LINE_BREAK)
    let bytes = await readRange(handle, start, size)
    let offset = start
    if (midLine) {
      const lineBreak = bytes.indexOf('\n')
      if (lineBreak < 0) {
        await this.#remember(file, handle, { inode: ino, size, offset: size, midLine: true })
        return { lines: [], continued }
      }
      bytes = bytes.subarray(lineBreak + 1)
      offset += lineBreak + 1
    }
    const { length, lines } = completeLines(bytes)
    await this.#remember(file, handle, {
      inode: ino,
      size,
      offset: offset + length,
      midLine: false,
    })
    return { lines, continued }
  }

  async #follows(
    handle: FileHandle,
    position: TailPosition,
    current: { size: number; ino: number },
  ): Promise<boolean> {
    if (current.ino !== position.inode || current.size < position.offset) return false
    const witnessStart = position.offset - position.witness.length
    return (await readRange(handle, witnessStart, position.offset)).equals(position.witness)
  }

  async #remember(
    file: string,
    handle: FileHandle,
    position: Omit<TailPosition, 'witness'>,
  ): Promise<void> {
    const witnessStart = Math.max(0, position.offset - WITNESS_BYTES)
    const witness = await readRange(handle, witnessStart, position.offset)
    this.#positions.set(file, { ...position, witness })
  }
}
