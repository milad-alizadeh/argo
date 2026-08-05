// The Activity list's row recipes — one box and one selected wash, shared so the two sections read
// as one list. Selection is an ink wash, not a tint: a filled row out-shouts the state its dot carries.

export const NAV_ROW =
  'flex w-full cursor-pointer items-center gap-snug rounded-md px-gap py-tight text-left outline-none hover:bg-foreground/4 focus-visible:ring-1 focus-visible:ring-ring/60'

export const NAV_ROW_SELECTED = 'bg-primary/10 ring-1 ring-inset ring-primary/20'

// The pane's header band, worn by BOTH headers on this surface — the agents rail's and the feed's
// sticky chapter seam. They sit side by side and their bottom hairlines are meant to read as one
// rule across the pane, which is only true if they are the same height and centre their contents
// the same way. Each having its own padding is what let them drift apart: same `py`, different
// contents, two different heights. Horizontal inset is deliberately NOT here — the rail is inset,
// the seam is a full-bleed sticky bar — but everything that decides where the rule lands is.
export const PANE_BAND = 'flex h-band shrink-0 items-center border-b border-b-inset-hair'

// What an opened body's PROSE is inset by, so its first character lands under the row's verb. Named
// because a bleeding body (a diff, a picture) still has prose beside the thing that bleeds — an
// output block under a patch — and that prose has to come back to the same column rather than to a
// second padding that merely looks close.
export const BODY_INSET = 'pr-gap pl-body-inset'

// What every control that opens something wears, layout excluded: the surface has three of them
// (a turn card, the subagents group, a thought) and they must all take focus the same way.
export const DISCLOSURE =
  'cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60'

// A turn is a CARD because its plan and steps belong to it — inset, never a second glass layer. The
// folded past turn is flat as well as quieter: the fall is what says a card is live.
export const TURN_CARD = 'rounded-lg inset-card'

export const TURN_CARD_PAST = 'rounded-lg bg-foreground/2 hover:bg-foreground/4'
