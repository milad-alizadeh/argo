import type { OutputResult } from '@shared'
import { Text } from '@/shared/components/ui'

// What a call PRINTED. Shared by the command row and the mutation row, because a failure of either
// kind has the same thing worth reading and this repo fails a build on duplication.
//
// The BLOCK only — it carries no toggle of its own. `ToolRow` owns the one caret every row has, so
// output, a diff and an absence line all arrive behind it rather than each bringing a disclosure
// and stacking three of them on one card.

/**
 * Molecule: the text a call printed, verbatim.
 *
 * The block scrolls at a bound rather than being truncated. A thousand-line log opened in place
 * would swallow the feed, and cutting it would hide the tail — which for a stack trace is the part
 * that names the cause.
 */
export function CallOutput({ output }: { output: OutputResult }): React.JSX.Element {
  return (
    // TEXT ONLY. The box, the padding and the boundary all belong to `ToolRow`, so an opened command
    // and an opened fold are the same object with different contents — this used to bring a card of
    // its own and a folded read brought none, which made two rows opened side by side disagree
    // about what an opened row looks like.
    <Text
      data-component="CallOutput"
      variant="code"
      className="max-h-output overflow-y-auto whitespace-pre-wrap break-words text-foreground-soft"
    >
      {output.text}
    </Text>
  )
}
