import type { RibbonNodeState } from '@shared'
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  CircleIcon,
  CircleNotchIcon,
  GearIcon,
  type IconAtom,
  ProhibitIcon,
  SOLID_PRIMARY_TONE,
  VERDICT_BLOCK_WASH,
  VERDICT_CHANGES_WASH,
  WASH_PRIMARY_TONE,
  WarningIcon,
} from '@/components/ui'

export interface RibbonNodeStatePresentation {
  /** The glyph the disc draws — chosen by state alone, never by which of the five nodes this
   * is: the node's own name already sits beside it as the `rlbl`, so the icon's only job is
   * to say where the STAGE stands. */
  Icon: IconAtom
  /** Tailwind classes for the 18px glyph disc — border, fill/wash and ink together, spent
   * from `ui/toneRecipes.ts` where button.tsx and badge.tsx already draw their own tones,
   * so the three never independently drift on the same opacity pair. */
  glyph: string
  /** Tailwind classes for the node's label and sub echo. */
  label: string
}

// `now`, `gate` and `sync` share one "active" glyph — the primary gradient disc the study
// paints identically for all three (`.rnode.now .glyph,.rnode.gate .glyph,.rnode.sync
// .glyph`). R2 draws gate apart from in-progress by FORM (the outer ring RibbonNode adds
// itself), never by a second tint — so the vocabulary only needs one entry for the shape.
const ACTIVE_GLYPH = SOLID_PRIMARY_TONE
const ACTIVE_LABEL = 'text-foreground'

/** State → icon + tone, in the `findingState.ts` pattern: every render fact about a ribbon
 * node's glyph lives here once, so RibbonNode never re-picks a colour for a state key. */
export const RIBBON_NODE_STATE: Record<RibbonNodeState, RibbonNodeStatePresentation> = {
  wait: {
    Icon: CircleIcon,
    glyph: 'border-border text-muted-foreground',
    label: 'text-foreground-faint',
  },
  now: { Icon: CircleNotchIcon, glyph: ACTIVE_GLYPH, label: ACTIVE_LABEL },
  gate: { Icon: CircleNotchIcon, glyph: ACTIVE_GLYPH, label: ACTIVE_LABEL },
  sync: { Icon: CircleNotchIcon, glyph: ACTIVE_GLYPH, label: ACTIVE_LABEL },
  auto: {
    Icon: GearIcon,
    glyph: WASH_PRIMARY_TONE,
    label: 'text-primary-soft',
  },
  done: {
    Icon: CheckIcon,
    glyph: 'border-transparent bg-tone-done text-background',
    label: 'text-muted-foreground',
  },
  fail: {
    Icon: ProhibitIcon,
    glyph: `${VERDICT_BLOCK_WASH} text-verdict-block`,
    label: 'text-verdict-block',
  },
  warn: {
    Icon: WarningIcon,
    glyph: `${VERDICT_CHANGES_WASH} text-verdict-changes`,
    label: 'text-verdict-changes',
  },
  // Stale is never red (R3: nothing failed, a fresher sha exists) — the dash and the
  // strikethrough are the tell, not a verdict tint.
  stale: {
    Icon: ArrowsClockwiseIcon,
    glyph: 'border-dashed border-tone-stale text-tone-stale',
    label: 'text-tone-stale line-through',
  },
  lock: {
    Icon: ProhibitIcon,
    glyph: 'border-border text-muted-foreground opacity-40',
    label: 'text-foreground-faint opacity-40',
  },
}
