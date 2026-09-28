import { closeSync, openSync, readdirSync, readSync, statSync, watch } from 'node:fs'
import path from 'node:path'
import type { HistoryChange, HistoryFiles, HistoryTurn } from '@/harnesses/registration'

const SETTLE_MS = 250
// Bytes just before the read offset, compared on each change to catch a rewrite that grew the file.
const WITNESS_BYTES = 64
const TURN_SCAN_CHUNK_BYTES = 64 * 1024
// A turn whose opening prompt lies further back than this reads as no marker.
const TURN_SCAN_BYTES = 1024 * 1024

function watchDirectory(
  directory: string,
  changed: (relativePath: string) => void,
): (() => void) | null {
  try {
    const watcher = watch(directory, { recursive: true }, (_event, filename) => {
      if (filename !== null) changed(String(filename))
    })
    watcher.on('error', (error) => {
      console.warn('Vendor history watcher stopped:', error)
      watcher.close()
    })
    return () => watcher.close()
  } catch (error) {
    console.warn('Vendor history watcher unavailable:', error)
    return null
  }
}

function locate(files: HistoryFiles, owner: string): string | null {
  try {
    const found = readdirSync(files.directory, { recursive: true, encoding: 'utf8' }).find(
      (relativePath) => files.ownerOf(relativePath) === owner,
    )
    return found === undefined ? null : path.join(files.directory, found)
  } catch {
    return null
  }
}

function readRange(file: string, start: number, end: number): Buffer {
  const buffer = Buffer.alloc(end - start)
  const descriptor = openSync(file, 'r')
  try {
    let read = 0
    while (read < buffer.length) {
      const count = readSync(descriptor, buffer, read, buffer.length - read, start + read)
      if (count === 0) break
      read += count
    }
    return buffer.subarray(0, read)
  } finally {
    closeSync(descriptor)
  }
}

type TailPosition = { file: string; inode: number; offset: number; witness: Buffer }

function positionAt(file: string, offset: number, inode: number): TailPosition {
  return {
    file,
    inode,
    offset,
    witness: readRange(file, Math.max(0, offset - WITNESS_BYTES), offset),
  }
}

function startingPosition(file: string | null): TailPosition | null {
  if (file === null) return null
  try {
    const { size, ino } = statSync(file)
    return positionAt(file, size, ino)
  } catch {
    return null
  }
}

type Growth =
  | { type: 'missing' }
  | { type: 'rewritten'; position: TailPosition }
  | { type: 'appended'; position: TailPosition; lines: string[] }

function isSameFile(position: TailPosition, file: string, stat: { size: number; ino: number }) {
  const witnessStart = position.offset - position.witness.length
  return (
    position.file === file &&
    position.inode === stat.ino &&
    stat.size >= position.offset &&
    readRange(file, witnessStart, position.offset).equals(position.witness)
  )
}

function completeLines(bytes: Buffer): { length: number; lines: string[] } {
  const complete = bytes.lastIndexOf('\n')
  if (complete < 0) return { length: 0, lines: [] }
  const lines = bytes
    .subarray(0, complete)
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
  return { length: complete + 1, lines }
}

// What changed in one history file since `position`, keeping a trailing partial line for later.
function growthOf(file: string, position: TailPosition | null): Growth {
  let stat: { size: number; ino: number }
  try {
    stat = statSync(file)
  } catch {
    return { type: 'missing' }
  }
  const current = position ?? { file, inode: stat.ino, offset: 0, witness: Buffer.alloc(0) }
  if (!isSameFile(current, file, stat))
    return { type: 'rewritten', position: positionAt(file, stat.size, stat.ino) }
  const { length, lines } = completeLines(readRange(file, current.offset, stat.size))
  const next = length === 0 ? current : positionAt(file, current.offset + length, stat.ino)
  return { type: 'appended', position: next, lines }
}

// Reads what a Harness appended to one Session's history file since the last change, and reports a
// change it cannot read as appended lines as rewritten.
export function tailSessionHistory(
  files: HistoryFiles,
  owner: string,
  changed: (change: HistoryChange) => void,
): () => void {
  let position = startingPosition(locate(files, owner))
  let read = files.openReader()
  let timer: ReturnType<typeof setTimeout> | null = null

  const rewritten = () => {
    read = files.openReader()
    changed({ type: 'rewritten' })
  }
  const readAppended = (file: string) => {
    const growth = growthOf(file, position)
    switch (growth.type) {
      case 'missing':
        if (position === null) return
        position = null
        return rewritten()
      case 'rewritten':
        position = growth.position
        return rewritten()
      case 'appended': {
        position = growth.position
        if (growth.lines.length === 0) return
        const change = read(growth.lines)
        if (change.type === 'rewritten') rewritten()
        else if (change.events.length > 0) changed(change)
      }
    }
  }
  const settle = (file: string) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      readAppended(file)
    }, SETTLE_MS)
  }
  const stop = watchDirectory(files.directory, (relativePath) => {
    if (files.ownerOf(relativePath) === owner) settle(path.join(files.directory, relativePath))
  })
  // The platform watcher starts late enough to miss a write made just after it was asked for.
  if (position !== null) settle(position.file)
  return () => {
    if (timer !== null) clearTimeout(timer)
    stop?.()
  }
}

// The newest turn marker in a history file, read backwards from its end within a bounded window.
export function latestTurn(file: string, turnOf: HistoryFiles['turnOf']): HistoryTurn | null {
  let size: number
  try {
    size = statSync(file).size
  } catch {
    return null
  }
  let end = size
  let carried = Buffer.alloc(0)
  while (end > 0 && size - end < TURN_SCAN_BYTES) {
    const start = Math.max(0, end - TURN_SCAN_CHUNK_BYTES)
    const bytes = Buffer.concat([readRange(file, start, end), carried])
    const firstBreak = start === 0 ? -1 : bytes.indexOf('\n')
    carried = firstBreak < 0 ? Buffer.alloc(0) : bytes.subarray(0, firstBreak)
    const lines = bytes
      .subarray(firstBreak + 1)
      .toString('utf8')
      .split('\n')
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const turn = turnOf(lines[index] ?? '')
      if (turn !== null) return turn
    }
    end = start
  }
  return null
}

// Names the owner of each history file a Harness writes to, whichever Session it belongs to, with
// the newest turn marker the file holds.
export function watchHistoryActivity(
  files: HistoryFiles,
  active: (owner: string, turn: HistoryTurn | null) => void,
): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const stop = watchDirectory(files.directory, (relativePath) => {
    const owner = files.ownerOf(relativePath)
    if (owner === null) return
    const pending = timers.get(owner)
    if (pending !== undefined) clearTimeout(pending)
    timers.set(
      owner,
      setTimeout(() => {
        timers.delete(owner)
        active(owner, latestTurn(path.join(files.directory, relativePath), files.turnOf))
      }, SETTLE_MS),
    )
  })
  return () => {
    for (const timer of timers.values()) clearTimeout(timer)
    stop?.()
  }
}
