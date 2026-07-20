import type { BadgeVariant } from './badge'
import type { ButtonVariant } from './button'
import {
  ArrowBendDownRightIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CircleIcon,
  CircleNotchIcon,
  DiamondIcon,
  type IconAtom,
  WarningIcon,
} from './icons'

export const FINDING_STATES = ['open', 'addressing', 'fixed'] as const

/** Where a review finding stands: open → addressing → fixed, and back to open on reopen. */
export type FindingState = (typeof FINDING_STATES)[number]

/** The tooltip that spells the cycle out wherever a finding's state is reported. */
export const FINDING_CYCLE_TITLE = 'finding state — Open → Addressing → Fixed'

type VerdictTone = Extract<BadgeVariant, `verdict-${string}`>

/** The word, glyph and tone a surface reports a finding's state with. */
type FindingReport = { label: string; Icon: IconAtom; tone: VerdictTone }

/** The same, for the control that advances the finding, plus the tooltip it carries. */
type FindingAction = { label: string; title: string; Icon: IconAtom; tone: ButtonVariant }

/** What the pill Badge beside a finding reports. The word is what keeps the state legible
 * without colour, so no surface may drop it and lean on the tone alone. */
export const FINDING_STATE_REPORT: Record<FindingState, FindingReport> = {
  open: { label: 'Open', Icon: CircleIcon, tone: 'verdict-block' },
  addressing: { label: 'Addressing', Icon: CircleNotchIcon, tone: 'verdict-changes' },
  fixed: { label: 'Fixed', Icon: CheckIcon, tone: 'verdict-approve' },
}

/** What the Button beside it DOES next — always the action, never the current state, since
 * the chip already reports that. This pair of maps is why neither primitive's variants may
 * be named after a state: `open` is reported in block ink but acted on in the changes tint. */
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

export const FINDING_SEVERITIES = ['blocking', 'advisory'] as const

/** How serious a review finding is — shared with #28, which reads this vocabulary rather
 * than re-deriving it. */
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number]

/** The word, glyph and tone a surface reports a finding's severity with. */
type SeverityReport = { word: string; Icon: IconAtom; tone: VerdictTone }

/** Replaces the study's ▲/◆ text glyphs with an icon atom, per severity. */
export const FINDING_SEVERITY: Record<FindingSeverity, SeverityReport> = {
  blocking: { word: 'blocking', Icon: WarningIcon, tone: 'verdict-block' },
  advisory: { word: 'advisory', Icon: DiamondIcon, tone: 'verdict-changes' },
}
