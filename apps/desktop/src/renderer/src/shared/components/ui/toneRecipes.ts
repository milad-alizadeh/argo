// The cockpit's tone recipes, spent by name instead of hand-copied — a washed tint is a
// border+background(+text) triple that no single Tailwind token covers, so each recipe
// lives here once and every caller (button.tsx, badge.tsx, the lifecycle's own state
// vocabulary) reads the same literal instead of re-typing the opacity pair.

/** The screen's ONE primary — a gradient disc/pill (R2). button.tsx's `primary` variant and
 * a state vocabulary's "active" glyph both spend this. */
export const SOLID_PRIMARY_TONE =
  'border-primary/55 bg-linear-to-br from-primary-bright to-primary text-primary-foreground'

/** The washed-primary triple — border+background+text as one unit. badge.tsx's `primary`
 * variant and a delegated/`auto` glyph both spend this. */
export const WASH_PRIMARY_TONE = 'border-primary/40 bg-primary/12 text-primary-soft'

/** A verdict's washed border+background pair — 55% border over a 12% fill, keyed to one
 * tint token. Each caller appends its own ink and hover suffix. */
export const VERDICT_CHANGES_WASH = 'border-verdict-changes-tint/55 bg-verdict-changes-tint/12'
export const VERDICT_APPROVE_WASH = 'border-verdict-approve-tint/55 bg-verdict-approve-tint/12'
export const VERDICT_BLOCK_WASH = 'border-verdict-block-tint/55 bg-verdict-block-tint/12'
