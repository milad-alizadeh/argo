import { cn } from '@/lib/utils'
import type { FindingState } from './findingState'
import { CheckIcon, CircleIcon, CircleNotchIcon, type IconAtom } from './icons'
import { Text } from './Text'

// Verdict ink over its own tint, one pair per state: the ink names the state and the wash
// only carries it — the word beside the glyph is what makes it legible without colour.
const STATE_TONE: Record<FindingState, string> = {
  open: 'text-verdict-block border-verdict-block-tint/40 bg-verdict-block-tint/12',
  addressing: 'text-verdict-changes border-verdict-changes-tint/40 bg-verdict-changes-tint/12',
  fixed: 'text-verdict-approve border-verdict-approve-tint/40 bg-verdict-approve-tint/12',
}

const STATE_WORD: Record<FindingState, string> = {
  open: 'Open',
  addressing: 'Addressing',
  fixed: 'Fixed',
}

const STATE_ICON: Record<FindingState, IconAtom> = {
  open: CircleIcon,
  addressing: CircleNotchIcon,
  fixed: CheckIcon,
}

// Atom: where a review finding stands, as a pill. It reports state and never acts — the
// control that advances the cycle is AddressButton, which travels beside it.
export function StateChip({
  state,
  className,
}: {
  /** Which rung of the finding cycle to report. */
  state: FindingState
  className?: string
}): React.JSX.Element {
  const Icon = STATE_ICON[state]
  return (
    <Text
      variant="tag"
      title="finding state — Open → Addressing → Fixed"
      className={cn(
        'inline-flex items-center gap-tight whitespace-nowrap rounded-full border px-gap py-hair',
        STATE_TONE[state],
        className,
      )}
    >
      <Icon aria-hidden />
      {STATE_WORD[state]}
    </Text>
  )
}
