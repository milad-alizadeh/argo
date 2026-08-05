import type { QuietCallModel, QuietRowModel } from '@shared'
import { BinocularsIcon, DotsThreeIcon, Text } from '@/shared/components/ui'
import { inkFor } from './minimapMatrix'
import { PathSubject } from './PathSubject'
import { ToolRow } from './ToolRow'

/** One word of a fold, in the case every other row's verb is set in.
 *
 * Sentence case, because `Run`, `Edit`, `Create` and `Failed` all are, and a column where one row
 * reads `read 3` among them looks like a different kind of row rather than a quieter one — the tier
 * is carried by the INK, and case carrying a second, contradictory signal is what made the fold look
 * foreign.
 *
 * Only a leading LOWERCASE letter is touched. Argo's own vocabulary (`read`, `searched`, `fetched`)
 * is Argo's to case; a word already capitalised is the HOST's own tool name, arriving where the
 * parser did not recognise it, and re-casing that would be rewording an external fact
 * (`CONTEXT.md` — a host's vocabulary is kept verbatim). `mcp__browser_navigate` stays as authored
 * rather than becoming `Mcp__browser_navigate`. */
const sentenceCase = (word: string): string =>
  /^[a-z]/.test(word) ? `${word[0]?.toUpperCase()}${word.slice(1)}` : word

/**
 * Molecule: a run of observation, folded to one line — `read 3 · searched 1` — and openable.
 *
 * COUNTS, never a sentence. A host-style summary degrades into "read a file, read a file, read a
 * file" at thirty calls, which is the wall of chatter this whole surface exists to correct; an
 * arithmetic label stays one line however long the run gets.
 *
 * It is the quietest thing the feed draws, and deliberately: twelve reads must not outweigh one
 * edit. But quiet is carried by its TONE and by its lack of a margin stub — not by a different
 * shape. It wears the same row as everything else, caret in the same leading column and glyph in
 * the same one after it. It had its own layout, with the caret flush right, which made the one row
 * on the surface least worth your attention the one row you had to learn separately.
 *
 * And it opens. Folding is not hiding, and it was hiding: "read 4" with no way to learn which four
 * meant the one question the row reliably provokes had no answer anywhere in the app. Closed it
 * still costs one line, so nothing about the density changes.
 */
export function QuietRow({ row }: { row: QuietRowModel }): React.JSX.Element {
  return (
    <ToolRow
      mark={{
        // BINOCULARS only where the run is observation Argo RECOGNISED. A run holding an
        // unrecognised tool gets a neutral mark instead: `other` is the parser saying it did not
        // know the name, and rendering that under a "looked at" glyph turns a gap in a lookup table
        // into a claim about what the agent did. `EnterWorktree` creates a worktree on disk.
        Icon: row.observed ? BinocularsIcon : DotsThreeIcon,
        // The counts ARE this row's verb — `read 3 · searched 1` says both what happened and how
        // much of it — so they take the word column, and the subject stays empty rather than
        // repeating them behind a second label.
        word: row.counts.map(({ word, count }) => `${sentenceCase(word)} ${count}`).join(' · '),
        tone: inkFor('quiet'),
      }}
      subject=""
    >
      <div className="flex flex-col">
        {row.calls.map((call) => (
          <QuietCall key={call.key} call={call} />
        ))}
      </div>
    </ToolRow>
  )
}

/** One folded call, opened: what it did and what it did it to. In the order they HAPPENED, not
 * grouped by kind like the counts above — this is a sequence of what the agent looked at, and the
 * counts are already the by-kind reading of the same run. */
function QuietCall({ call }: { call: QuietCallModel }): React.JSX.Element {
  return (
    <Text
      variant="code"
      className="flex min-w-0 items-baseline gap-snug text-foreground-faint"
      title={call.target ?? undefined}
    >
      <span className="shrink-0 text-foreground-faint/70">{sentenceCase(call.word)}</span>
      {/* `PathSubject`, not a plain truncate: five reads under one worktree share sixty characters
          of prefix, so end-truncation rendered the whole fold as five identical lines. The full path
          stays on the row's `title` for the case where the middle is the part you wanted. */}
      <PathSubject path={call.target} absent="nothing the record named" />
    </Text>
  )
}
