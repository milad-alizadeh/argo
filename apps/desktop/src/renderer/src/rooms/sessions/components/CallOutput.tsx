import type { OutputResult } from '@shared'
import { cn } from '@/lib/utils'
import { CaretDownIcon, CaretRightIcon, Text, useDisclosure } from '@/shared/components/ui'
import { RowGlyph } from './RowGlyph'
import { DISCLOSURE } from './rowRecipes'

// What a call PRINTED, one click away or already open. Shared by the command row and the mutation
// row, because a failure of either kind has the same thing worth reading and this repo fails a build
// on duplication.

/**
 * Molecule: a call's output, gated.
 *
 * `defaultOpen` is the DERIVATION's decision arriving here as a prop rather than this component's:
 * a failure opens so the thing that went wrong is the thing you see, and a success stays closed so a
 * build log does not bury the paragraph beside it.
 *
 * The block scrolls at a bound rather than being truncated. A thousand-line log opened in place
 * would swallow the feed, and cutting it would hide the tail — which for a stack trace is the part
 * that names the cause.
 */
export function CallOutput({
  output,
  defaultOpen,
}: {
  /** The text the call printed, verbatim. */
  output: OutputResult
  /** Whether it is shown without asking. */
  defaultOpen: boolean
}): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen })
  const Caret = open ? CaretDownIcon : CaretRightIcon
  return (
    <div data-component="CallOutput" className="flex flex-col gap-tight">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(DISCLOSURE, 'flex items-baseline gap-snug')}
      >
        <RowGlyph Icon={Caret} tone="text-foreground-faint" />
        <Text variant="code" className="text-foreground-faint">
          output
        </Text>
      </button>
      {open && (
        <div className="flex items-baseline gap-snug">
          {/* The mark column, empty. The text starts on the SAME axis as the label above it and as
              the row's own word above that, so the block reads as one column rather than as three
              indents that each missed the last by a few pixels. */}
          <span aria-hidden className="w-mark-col shrink-0" />
          <Text
            variant="code"
            className="max-h-output min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-foreground-soft"
          >
            {output.text}
          </Text>
        </div>
      )}
    </div>
  )
}
