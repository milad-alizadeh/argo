import { type QuietRowModel, quietLabel } from '@shared'
import { BinocularsIcon, Text } from '@/shared/components/ui'
import { RowGlyph } from './RowGlyph'

/**
 * Molecule: a run of observation, folded to one line — `read 3 · searched 1`.
 *
 * COUNTS, never a sentence. A host-style summary degrades into "read a file, read a file, read a
 * file" at thirty calls, which is the wall of chatter this whole surface exists to correct; an
 * arithmetic label stays one line however long the run gets.
 *
 * It is the quietest thing the feed draws, and deliberately: twelve reads must not outweigh one edit.
 * It carries no card, no rail and no expander — a read is provenance, and one line is what provenance
 * is worth. The run sits directly above the paragraph it is the evidence for, which is the reading
 * the derivation's fold exists to produce.
 */
export function QuietRow({ row }: { row: QuietRowModel }): React.JSX.Element {
  return (
    <div data-component="QuietRow" className="flex items-baseline gap-snug">
      <RowGlyph Icon={BinocularsIcon} tone="text-foreground-faint" />
      <Text variant="code" className="min-w-0 flex-1 truncate text-foreground-faint">
        {/* The same tally the navigation entry for this row reads, spelled once in the derivation. */}
        {quietLabel(row.counts)}
      </Text>
    </div>
  )
}
