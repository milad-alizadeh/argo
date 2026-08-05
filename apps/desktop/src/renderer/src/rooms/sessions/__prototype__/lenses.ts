import type { FeedRow } from '@shared'
import type { Chapter } from './feedIndex'

// PROTOTYPE — variant C's whole model: you navigate a long feed by SHORTENING it, not by indexing it.
// A lens is a reading of the same session, so each one keeps whole rows verbatim and drops the rest —
// nothing here summarises, which is the line a DERIVED tier cannot cross.

export const LENSES = ['all', 'changed', 'said', 'ran'] as const
export type Lens = (typeof LENSES)[number]

/** What each lens is for, in the one word the control wears plus the sentence under it. */
export const LENS_BLURB: Record<Lens, string> = {
  all: 'everything observed, in order',
  changed: 'only the rows that changed a file or produced a picture',
  said: 'only the prompts and the answers — the session as a conversation',
  ran: 'only the commands and the observation behind them',
}

const KEEP: Record<Lens, readonly FeedRow['kind'][]> = {
  all: ['prompt', 'message', 'thought', 'mutation', 'call', 'quiet', 'media', 'plan', 'compaction'],
  changed: ['mutation', 'media'],
  said: ['prompt', 'message'],
  ran: ['call', 'quiet'],
}

export interface LensedChapter extends Chapter {
  /** How many of the chapter's rows the lens dropped — said out loud, because a feed that quietly
   * hides two thirds of itself is a feed you will misread. */
  hidden: number
}

/** The chapters through one lens: rows filtered, chapters the lens emptied dropped entirely. */
export function throughLens(chapters: readonly Chapter[], lens: Lens): LensedChapter[] {
  const keep = new Set(KEEP[lens])
  return chapters
    .map((chapter) => {
      const rows = chapter.rows.filter((row) => keep.has(row.kind))
      return { ...chapter, rows, hidden: chapter.rows.length - rows.length }
    })
    .filter((chapter) => chapter.rows.length > 0)
}

export const rowCount = (chapters: readonly { rows: readonly FeedRow[] }[]): number =>
  chapters.reduce((total, chapter) => total + chapter.rows.length, 0)

/** One thing you can jump to. Turns, delegates and edited files — the three things a reader actually
 * looks for by name, which is the answer to "what would an index be for if it were not a mirror". */
export interface JumpTarget {
  /** The list's own identity — a file can be edited in two turns, so the key alone is not unique. */
  id: string
  /** Where the jump lands: the chapter holding it. */
  key: string
  kind: 'turn' | 'subagent' | 'file'
  label: string
  hint: string
}

const target = (
  chapter: Chapter,
  found: { kind: JumpTarget['kind']; label: string; hint: string },
): JumpTarget => ({
  id: `${chapter.key}:${found.kind}:${found.label}`,
  key: chapter.key,
  ...found,
})

function fileTargets(chapter: Chapter): JumpTarget[] {
  const hint = `turn ${chapter.ordinal}`
  return chapter.rows.flatMap((row) =>
    row.kind === 'mutation' && row.path !== null
      ? [target(chapter, { kind: 'file', label: row.path, hint })]
      : [],
  )
}

export function jumpTargets(chapters: readonly Chapter[]): JumpTarget[] {
  return chapters.flatMap((chapter) => {
    const hint = `turn ${chapter.ordinal}`
    return [
      target(chapter, { kind: 'turn', label: chapter.promptLine ?? hint, hint }),
      ...chapter.delegates.map((item) =>
        target(chapter, {
          kind: 'subagent',
          label: item.subagent.name,
          hint: item.group ?? 'subagent',
        }),
      ),
      ...fileTargets(chapter),
    ]
  })
}

export const matching = (targets: readonly JumpTarget[], query: string): JumpTarget[] => {
  const needle = query.trim().toLowerCase()
  return needle === ''
    ? [...targets]
    : targets.filter((target) => target.label.toLowerCase().includes(needle))
}
