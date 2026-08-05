import type { DiffHunk, DiffLine } from '@shared'
import { cn } from '@/lib/utils'
import { type CodeToken, highlightLines } from './codeHighlight'
import { Text } from './Text'

// One hunk's rows. Split from `DiffView` because the two answer different questions — this one is
// "how does a line of a patch read", and `DiffView` is "how much of a patch does a surface show".

// The marker each side prints. The CHARACTER is rendered, never replaced by an icon and never
// dropped in favour of the tint: a diff has had its own notation for fifty years, it survives
// being copied out of the app, and colour alone cannot carry meaning to a reader who cannot see it.
const SIDE_MARKER: Readonly<Record<DiffLine['side'], string>> = { add: '+', del: '-', context: ' ' }

// Add and del are carried by the ROW — a tinted band and a coloured marker — rather than by the
// text, which is the whole reason this file exists. Tinting the text means the code's own syntax
// colouring has nowhere to go: every added line reads as one flat green regardless of what it says,
// so the diff tells you THAT something changed while hiding WHAT. The band says which side; the
// syntax says what.
const SIDE_ROW: Readonly<Record<DiffLine['side'], string>> = {
  add: 'bg-signal-ok/10',
  del: 'bg-signal-bad/10',
  context: '',
}

const SIDE_MARK: Readonly<Record<DiffLine['side'], string>> = {
  add: 'text-signal-ok',
  del: 'text-signal-bad',
  context: 'text-foreground-faint',
}

/** Where a line sits in the file, on the side it belongs to: an added line has no old number and a
 * deleted one has no new number, so the gutter counts the two independently and blanks the column
 * that does not apply. A patch without numbers cannot be taken to the file it describes. */
function lineNumbers(hunk: DiffHunk): (number | null)[] {
  let next = hunk.newStart
  let old = hunk.oldStart
  return hunk.lines.map((line) => {
    if (line.side === 'del') return old++
    old += line.side === 'context' ? 1 : 0
    return next++
  })
}

/** One line of the patch: its number, its marker, and its code with its own colours. */
function Line({
  line,
  number,
  tokens,
}: {
  line: DiffLine
  number: number | null
  tokens: readonly CodeToken[]
}): React.JSX.Element {
  return (
    <div className={cn('flex items-baseline gap-snug px-snug', SIDE_ROW[line.side])}>
      <span className="w-[4ch] shrink-0 text-right text-foreground-faint tabular-nums">
        {number ?? ''}
      </span>
      <span aria-hidden className={cn('w-[1ch] shrink-0', SIDE_MARK[line.side])}>
        {SIDE_MARKER[line.side]}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
        {tokens.map((token, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a static tokenization — the position IS the token's identity.
          <span key={index} style={token.color ? { color: token.color } : undefined}>
            {token.content}
          </span>
        ))}
      </span>
    </div>
  )
}

/**
 * Molecule: one hunk, highlighted.
 *
 * The whole hunk is tokenized in one pass so a multi-line construct keeps its context, then sliced
 * back per line — see `codeHighlight.ts`. The marker column is OUTSIDE that text, which is what
 * lets the code be tokenized as code: prefixing every line with `+` first would leave the grammar
 * reading a file that does not parse.
 */
export function DiffLines({
  hunk,
  language,
}: {
  hunk: DiffHunk
  /** The grammar to read the code with, `null` for a file this app carries none for. */
  language: string | null
}): React.JSX.Element {
  const numbers = lineNumbers(hunk)
  const tokens = highlightLines(
    hunk.lines.map((line) => line.text),
    language,
  )
  return (
    <Text as="div" variant="code" className="flex flex-col">
      {hunk.lines.map((line, index) => (
        <Line
          // biome-ignore lint/suspicious/noArrayIndexKey: a static ordered patch — the position IS the line's identity.
          key={index}
          line={line}
          number={numbers[index] ?? null}
          tokens={tokens[index] ?? []}
        />
      ))}
    </Text>
  )
}
