import type { BadgeVariant } from './badge'
import type { ButtonVariant } from './button'
import {
  ArrowBendDownRightIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CircleIcon,
  CircleNotchIcon,
  type IconAtom,
} from './icons'

export const FINDING_STATES = ['open', 'addressing', 'fixed'] as const

/** Where a review finding stands: open → addressing → fixed, and back to open on reopen. */
export type FindingState = (typeof FINDING_STATES)[number]

/** The word, glyph and tone a surface reports a finding's state with. */
type FindingReport = { label: string; Icon: IconAtom; tone: BadgeVariant }

/** The same, for the control that advances the finding, plus the tooltip it carries. */
type FindingAction = { label: string; title: string; Icon: IconAtom; tone: ButtonVariant }

// The ONE binding of the finding cycle to a rendering. Both homes of a finding — the
// Review-tab row and the card wedged under a hunk — read it, so they cannot drift; and it
// lives here rather than in a primitive's variant map because a tone is a token, not a
// state. `open` is the proof: reported in block ink, acted on in the changes tint.

/** What the pill Badge beside a finding reports. The word is what keeps the state legible
 * without colour, so no surface may drop it and lean on the tone alone. */
export const FINDING_STATE_REPORT: Record<FindingState, FindingReport> = {
  open: { label: 'Open', Icon: CircleIcon, tone: 'verdict-block' },
  addressing: { label: 'Addressing', Icon: CircleNotchIcon, tone: 'verdict-changes' },
  fixed: { label: 'Fixed', Icon: CheckIcon, tone: 'verdict-approve' },
}

/** What the Button beside it DOES next — always the action, never the current state, since
 * the chip already reports that. The tone follows the state the finding is in: amber while
 * open, green once the fix is dispatched, quiet once fixed. */
export const FINDING_STATE_ACTION: Record<FindingState, FindingAction> = {
  open: {
    label: 'Address',
    title: "dispatch code-review's fix agent",
    Icon: ArrowBendDownRightIcon,
    tone: 'verdict-changes',
  },
  addressing: {
    label: 'Mark fixed',
    title: 'mark the dispatched fix confirmed',
    Icon: CheckIcon,
    tone: 'verdict-approve',
  },
  fixed: {
    label: 'Reopen',
    title: 'reopen this finding',
    Icon: ArrowCounterClockwiseIcon,
    tone: 'ghost',
  },
}
