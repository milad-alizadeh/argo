import type { QuietCallModel, QuietCount, QuietRowModel, ToolCallKind } from '@shared'
import {
  BinocularsIcon,
  DotsThreeIcon,
  FileTextIcon,
  type IconAtom,
  MagnifyingGlassIcon,
  TerminalWindowIcon,
} from '@/shared/components/ui'
import { CallOutput } from './CallOutput'
import { relativeTo } from './feedPath'
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

/** What each folded call wears once the fold is open. A run is no longer all one kind — commands
 * fold in beside reads — so a single glyph for the whole list would say they were. */
const GLYPH_FOR: Readonly<Record<ToolCallKind, IconAtom>> = {
  execute: TerminalWindowIcon,
  search: MagnifyingGlassIcon,
  read: FileTextIcon,
  fetch: FileTextIcon,
  edit: FileTextIcon,
  delegate: DotsThreeIcon,
  plan: DotsThreeIcon,
  other: DotsThreeIcon,
}

/** The thing each of Argo's own verbs counts, singular and plural.
 *
 * `Ran 5` states an amount of nothing in particular; `ran 5 shell commands` states a fact. The noun
 * costs a few characters on a line that is already the shortest on the surface, and it is what makes
 * the fold read as a sentence rather than as a tally you have to decode. The phrasing is Claude
 * Code's own for the same summary, which is the vocabulary the reader arrives already fluent in.
 *
 * Keyed by WORD and deliberately partial: a word missing here is the host's own tool name, arriving
 * where the parser did not recognise it, and Argo has no noun for a tool it cannot name. Those keep
 * the bare count rather than being given an invented one. */
const QUIET_NOUN: Readonly<Record<string, readonly [string, string]>> = {
  ran: ['shell command', 'shell commands'],
  read: ['file', 'files'],
  searched: ['pattern', 'patterns'],
  fetched: ['page', 'pages'],
}

/** One tally as words — `ran 5 shell commands`.
 *
 * ONE ink across the whole line, and one STRING. The count was briefly lifted a step in brightness
 * to be scannable and read as a different KIND of thing instead — the fold's whole job is to be the
 * quietest line on the surface, and a two-tone line is louder than a plain one however quiet each
 * tone is. With nothing to colour, the line is text rather than a tree of spans, which is also what
 * lets it be read as one string by anything that looks at it. */
function countLabel(tally: QuietCount, first: boolean): string {
  const noun = QUIET_NOUN[tally.word]
  const word = first ? sentenceCase(tally.word) : tally.word
  const said = `${word} ${tally.count}`
  if (noun === undefined) return said
  return `${said} ${tally.count === 1 ? noun[0] : noun[1]}`
}

/** The whole fold's line: one clause per kind, comma-joined, sentence-cased ONCE at the head.
 *
 * A sentence, not a list of chips. `Read 3 files, ran 5 shell commands` is how the CLI this feed
 * observes says the same thing, and capitalising every clause (`Read 3 · Ran 5`) reads as a row of
 * separate labels rather than as one summary of one run — which is what it is. */
const foldLine = (counts: readonly QuietCount[]): string =>
  counts.map((tally, index) => countLabel(tally, index === 0)).join(', ')

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
export function QuietRow({
  row,
  root,
}: {
  row: QuietRowModel
  root: string | null
}): React.JSX.Element {
  // A FOLD OF ONE IS NOT A FOLD. `Ran 1 shell command` opening onto a single row that names the
  // command is a caret you press twice to reach one answer, and a box drawn around one box —
  // ceremony standing in for the summary it has nothing to summarise. The call renders as its own
  // quiet row instead: same tier, same ink, its target on the line, its output one caret away.
  const only = row.calls.length === 1 ? row.calls[0] : undefined
  if (only !== undefined) return <QuietCall call={only} root={root} />
  return (
    <ToolRow
      mark={{
        // BINOCULARS only where the run is observation Argo RECOGNISED. A run holding an
        // unrecognised tool gets a neutral mark instead: `other` is the parser saying it did not
        // know the name, and rendering that under a "looked at" glyph turns a gap in a lookup table
        // into a claim about what the agent did. `EnterWorktree` creates a worktree on disk.
        Icon: row.observed ? BinocularsIcon : DotsThreeIcon,
        // The counts ARE this row's verb — `Read 3 files, ran 1 shell command` says both what
        // happened and how much of it — so they take the word column, and the subject stays empty
        // rather than repeating them behind a second label.
        word: foldLine(row.counts),
        tone: inkFor('quiet'),
      }}
      subject=""
    >
      {/* ONE card, at the first layer. Everything the fold opens onto lives in it — the calls, and
          whatever any of them prints when its own caret is pressed. A card per nested row put a
          border around every line inside a border already around all of them, which reads as a
          stack of separate things rather than as one run opened up. */}
      <div className="flex flex-col">
        {row.calls.map((call) => (
          <QuietCall key={call.key} call={call} root={root} nested />
        ))}
      </div>
    </ToolRow>
  )
}

/** One folded call, opened: a ROW like any other — what it did, what it did it to, and its own caret
 * onto what it printed.
 *
 * The output is the whole reason this is a row rather than a line of text. Folding commands is what
 * made the feed readable, and a fold that dropped their output would have bought that readability by
 * deleting the answer — `bun run test` folded to a tally with no way to reach the failures is worse
 * than the wall it replaced. A fold is a COLLAPSE: open it and you get back exactly the rows you
 * would have had, each still one caret from what it said.
 */
function QuietCall({
  call,
  root,
  nested = false,
}: {
  call: QuietCallModel
  root: string | null
  /** Whether this sits INSIDE the fold's card. Nested, its output takes no box of its own — it is
   * already inside one, and the second border would be the same boundary drawn twice. Standing on
   * its own (a run of one, which does not fold) it is an ordinary row and brings its own. */
  nested?: boolean
}): React.JSX.Element {
  return (
    <ToolRow
      mark={{
        Icon: GLYPH_FOR[call.callKind],
        word: sentenceCase(call.word),
        tone: call.status === 'failed' ? inkFor('call', true) : inkFor('quiet'),
      }}
      subject={<CallSubject call={call} root={root} />}
      origin={call.isPath && call.target !== null ? relativeTo(call.target, root) : null}
      body={nested ? 'bare' : 'card'}
    >
      {call.output === null ? null : <CallOutput output={call.output} />}
    </ToolRow>
  )
}

/** What the folded call names. A path takes the name-first reading; a COMMAND reads whole, because it
 * has slashes and no filename to lead with — split at its last separator, `… | head -50` would be
 * lifted out and presented as a file. */
function CallSubject({
  call,
  root,
}: {
  call: QuietCallModel
  root: string | null
}): React.JSX.Element {
  if (call.isPath) {
    return <PathSubject path={call.target} root={root} absent="nothing the record named" />
  }
  return (
    <span className="min-w-0 flex-1 truncate">
      {call.target ?? 'a command the record did not name'}
    </span>
  )
}
