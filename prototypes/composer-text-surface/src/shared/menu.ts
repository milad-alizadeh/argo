// PROTOTYPE. The composer menu model, ported from ComposerMenu.swift closely enough that the
// four text surfaces are being compared on the same work, not on four different simplifications.

import { addEntries, type Command, commands, files } from './catalog'

export type Badge = { words: string; tone: 'quiet' | 'attention' }
export type Detail = { words: string; voice: 'sentence' | 'path' }

export type Row = {
  id: string
  /** What replaces the token in the draft, trailing space included. */
  insert: string
  lead: string
  /** The characters of `lead` the typing matched, inked in the accent. */
  matched: [number, number] | null
  detail: Detail | null
  badges: Badge[]
}

export type Section = { id: string; label: string | null; detail: string | null; rows: Row[] }

export type Status = { words: string; mark: 'waiting' | 'failed' }

export type Sigil = {
  mark: '/' | '@' | '+'
  label: string
  nothingMatched: string
}

export const commandSigil: Sigil = {
  mark: '/',
  label: 'Skills and commands',
  nothingMatched: 'No skill or command matches ',
}

export const fileSigil: Sigil = {
  mark: '@',
  label: 'Files in this Workspace',
  nothingMatched: 'No file in this Workspace matches ',
}

export const addSigil: Sigil = {
  mark: '+',
  label: 'Add to this Turn',
  nothingMatched: 'Nothing here matches ',
}

export type Listing = {
  sections: Section[]
  query: string
  sigil: Sigil
  status: Status | null
  isReading: boolean
  /** How many trailing characters of the draft a pick takes with it. */
  dropping: number
}

export const zeroLineTail = '. Your line is still just text — ⏎ sends it as written.'

export function rowsOf(listing: Listing): Row[] {
  return listing.sections.flatMap((section) => section.rows)
}

/** Whether a sigil stands at a token boundary rather than inside a word. */
function opensToken(text: string, index: number): boolean {
  if (index === 0) return true
  return /\s/.test(text[index - 1] as string)
}

/**
 * What was typed after the sigil at the caret, or null where the caret is not in such a token.
 *
 * Caret-aware where the Swift reads the whole line: a DOM surface always has a caret, and the
 * token being typed is the one it sits in.
 */
export function tokenAt(text: string, caret: number, mark: '/' | '@'): string | null {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf(mark)
  if (at < 0 || !opensToken(text, at)) return null
  const typed = before.slice(at + 1)
  if (/\s/.test(typed)) return null
  if (mark === '/' && typed.includes('/')) return null
  return typed
}

/**
 * The range of the command name the CLI will actually run as one, or null where the draft opens
 * with none (#1256). Only at index 0, and it stands past the first space.
 */
export function commandMark(text: string): [number, number] | null {
  if (!text.startsWith('/')) return null
  const name = /^\/(\S*)/.exec(text)?.[1] ?? ''
  if (name.length === 0 || name.includes('/')) return null
  return [0, name.length + 1]
}

/** Where the typing matched the row's lead, for the accent ink on those characters. */
function matchRange(lead: string, query: string): [number, number] | null {
  if (query.length === 0) return null
  const at = lead.toLowerCase().indexOf(query.toLowerCase())
  if (at < 0) return null
  return [at, at + query.length]
}

function badgesFor(command: Command): Badge[] {
  const badges: Badge[] = []
  if (command.shadowsUser) badges.push({ words: 'SHADOWS USER', tone: 'attention' })
  return badges
}

function commandRow(command: Command, query: string): Row {
  return {
    id: `${command.origin}/${command.name}`,
    insert: `/${command.name} `,
    lead: command.name,
    matched: matchRange(command.name, query),
    detail: { words: command.detail, voice: 'sentence' },
    badges: badgesFor(command),
  }
}

const origins: Command['origin'][] = ['Project', 'Global', 'Plugin', 'Claude Code']

function byOrigin(catalog: Command[], query: string): Section[] {
  return origins
    .map((origin) => {
      const rows = catalog.filter((c) => c.origin === origin).map((c) => commandRow(c, query))
      return { id: origin, label: origin, detail: `${rows.length}`, rows }
    })
    .filter((section) => section.rows.length > 0)
}

function commandSections(catalog: Command[], query: string): Section[] {
  if (query.length === 0) return byOrigin(catalog, query)
  const lower = query.toLowerCase()
  const prefix = catalog.filter((c) => c.name.toLowerCase().startsWith(lower))
  const rest = catalog.filter(
    (c) => !c.name.toLowerCase().startsWith(lower) && c.name.toLowerCase().includes(lower),
  )
  const sections: Section[] = []
  if (prefix.length > 0) {
    sections.push({
      id: 'prefix',
      label: null,
      detail: null,
      rows: prefix.map((c) => commandRow(c, query)),
    })
  }
  sections.push(...byOrigin(rest, query))
  return sections
}

function fileRow(path: string, query: string): Row {
  const name = path.split('/').pop() as string
  return {
    id: path,
    insert: `@${path} `,
    lead: name,
    matched: matchRange(name, query),
    detail: { words: path, voice: 'path' },
    badges: [],
  }
}

/** The catalog's slower half, so the pinned status strip has something true to say. */
export type CatalogState = { builtinsRead: boolean; filesFailed: boolean }

export function listingFor(
  text: string,
  caret: number,
  state: CatalogState,
  add: boolean,
): Listing | null {
  if (add) {
    return {
      sections: [
        {
          id: 'add',
          label: null,
          detail: null,
          rows: addEntries.map((entry) => ({
            id: entry.id,
            insert: entry.id === 'mention' ? '@' : `/${entry.id} `,
            lead: entry.lead,
            matched: null,
            detail: { words: entry.detail, voice: 'sentence' },
            badges: [],
          })),
        },
      ],
      query: '',
      sigil: addSigil,
      status: null,
      isReading: false,
      // The sigil was never typed, so a pick has nothing of its own to drop.
      dropping: 0,
    }
  }

  const command = tokenAt(text, caret, '/')
  if (command !== null) {
    if (!state.builtinsRead) {
      return {
        sections: [],
        query: command,
        sigil: commandSigil,
        status: { words: 'Reading skills…', mark: 'waiting' },
        isReading: true,
        dropping: command.length + 1,
      }
    }
    return {
      sections: commandSections(commands, command),
      query: command,
      sigil: commandSigil,
      status: null,
      isReading: false,
      dropping: command.length + 1,
    }
  }

  const mention = tokenAt(text, caret, '@')
  if (mention !== null) {
    const lower = mention.toLowerCase()
    const matched = files.filter((path) => path.toLowerCase().includes(lower))
    return {
      sections:
        matched.length > 0
          ? [
              {
                id: 'files',
                label: null,
                detail: `${matched.length}`,
                rows: matched.map((p) => fileRow(p, mention)),
              },
            ]
          : [],
      query: mention,
      sigil: fileSigil,
      status: state.filesFailed
        ? { words: 'Some directories could not be read', mark: 'failed' }
        : null,
      isReading: false,
      dropping: mention.length + 1,
    }
  }

  return null
}

export type Pick = { text: string; dropping: number }

/** The line a picked row leaves, and where the caret lands in it. */
export function taken(line: string, caret: number, pick: Pick): { text: string; caret: number } {
  const head = line.slice(0, caret - pick.dropping)
  const tail = line.slice(caret)
  return { text: head + pick.text + tail, caret: head.length + pick.text.length }
}
