import { closeSync, openSync, readdirSync, readSync, statSync, watch } from 'node:fs'
import path from 'node:path'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type {
  HistoryChange,
  HistoryFiles,
  HistoryTurn,
  HistoryTurnMarker,
} from '@/harnesses/registration'

const SETTLE_MS = 250
// The window a first change opens on, before which no read position for that Session exists.
const ACTIVITY_TAIL_BYTES = 256 * 1024
// Bytes just before the read offset, compared on each change to catch a rewrite that grew the file.
const WITNESS_BYTES = 64
const TURN_SCAN_CHUNK_BYTES = 64 * 1024
// A turn whose opening prompt lies further back than this reads as no marker.
const TURN_SCAN_BYTES = 1024 * 1024
const EXISTING_LINE_BYTES = 1024 * 1024

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

// The complete lines in the window that ends at the tail's position, for a reader to start from.
function existingLines(position: TailPosition | null): string[] {
  if (position === null) return []
  const start = Math.max(0, position.offset - EXISTING_LINE_BYTES)
  const bytes = readRange(position.file, start, position.offset)
  const firstBreak = start === 0 ? -1 : bytes.indexOf('\n')
  return completeLines(bytes.subarray(firstBreak + 1)).lines
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
  let read = files.openReader(existingLines(position))
  let timer: ReturnType<typeof setTimeout> | null = null

  const rewritten = () => {
    read = files.openReader(existingLines(position))
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

// Reads markers newest first. The newest opened turn is the current one, so a close only counts
// when it names that turn or names none; a close for an earlier turn is stale.
class TurnScan {
  readonly #closedTurnIds = new Set<string>()

  // The current turn's state once a marker settles it; undefined while older lines still decide.
  read(marker: HistoryTurnMarker): HistoryTurn | undefined {
    // No opening has been read yet, so every close here is newer than the current turn's start.
    if (marker.turn === 'closed') {
      if (marker.turnId === null) return 'closed'
      this.#closedTurnIds.add(marker.turnId)
      return undefined
    }
    if (marker.turnId === null) return this.#closedTurnIds.size > 0 ? 'closed' : 'open'
    return this.#closedTurnIds.has(marker.turnId) ? 'closed' : 'open'
  }

  // The newest lines of a chunk first; undefined when none of them settles the current turn.
  readLines(lines: readonly string[], turnOf: HistoryFiles['turnOf']): HistoryTurn | undefined {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const marker = turnOf(lines[index] ?? '')
      const turn = marker === null ? undefined : this.read(marker)
      if (turn !== undefined) return turn
    }
    return undefined
  }

  // The window ended before an opening marker: a close seen without its opening still closed a turn.
  get exhausted(): HistoryTurn | null {
    return this.#closedTurnIds.size > 0 ? 'closed' : null
  }
}

// The current turn's state in a history file, read backwards from its end within a bounded window.
export function latestTurn(file: string, turnOf: HistoryFiles['turnOf']): HistoryTurn | null {
  let size: number
  try {
    size = statSync(file).size
  } catch {
    return null
  }
  const scan = new TurnScan()
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
    const turn = scan.readLines(lines, turnOf)
    if (turn !== undefined) return turn
    end = start
  }
  return scan.exhausted
}

// The window's first whole line, so a reader that has never seen this file starts on a record.
function tailWindowPosition(file: string): TailPosition | null {
  try {
    const { size, ino } = statSync(file)
    const start = Math.max(0, size - ACTIVITY_TAIL_BYTES)
    if (start === 0) return positionAt(file, 0, ino)
    const firstBreak = readRange(file, start, size).indexOf('\n')
    return firstBreak < 0 ? null : positionAt(file, start + firstBreak + 1, ino)
  } catch {
    return null
  }
}

// The lines each watched Session appended since the last change, decoded by the Harness's own
// reader. A Session is read only while it is writing, so an idle roster decodes nothing.
class ActivityTails {
  readonly #files: HistoryFiles
  readonly #tails = new Map<
    string,
    { position: TailPosition; read: (lines: readonly string[]) => HistoryChange }
  >()

  constructor(files: HistoryFiles) {
    this.#files = files
  }

  events(owner: string, file: string): SessionLiveEventBody[] {
    const tail = this.#tails.get(owner) ?? this.#start(owner, file)
    if (tail === null) return []
    const growth = growthOf(file, tail.position)
    if (growth.type === 'missing') {
      this.#tails.delete(owner)
      return []
    }
    tail.position = growth.position
    if (growth.type === 'rewritten' || growth.lines.length === 0) {
      if (growth.type === 'rewritten') tail.read = this.#files.openReader([])
      return []
    }
    const change = tail.read(growth.lines)
    if (change.type === 'appended') return change.events
    tail.read = this.#files.openReader([])
    return []
  }

  #start(owner: string, file: string) {
    const position = tailWindowPosition(file)
    if (position === null) return null
    const tail = { position, read: this.#files.openReader([]) }
    this.#tails.set(owner, tail)
    return tail
  }
}

// Names the owner of each history file a Harness writes to, whichever Session it belongs to, with
// the newest turn marker the file holds and the content of the lines it just gained.
export function watchHistoryActivity(
  files: HistoryFiles,
  active: (owner: string, turn: HistoryTurn | null, events: SessionLiveEventBody[]) => void,
): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const tails = new ActivityTails(files)
  const stop = watchDirectory(files.directory, (relativePath) => {
    const owner = files.ownerOf(relativePath)
    if (owner === null) return
    const pending = timers.get(owner)
    if (pending !== undefined) clearTimeout(pending)
    timers.set(
      owner,
      setTimeout(() => {
        timers.delete(owner)
        const file = path.join(files.directory, relativePath)
        active(owner, latestTurn(file, files.turnOf), tails.events(owner, file))
      }, SETTLE_MS),
    )
  })
  return () => {
    for (const timer of timers.values()) clearTimeout(timer)
    stop?.()
  }
}
