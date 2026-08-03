// The Activity list's row recipes — one box and one selected wash, shared so the two sections read
// as one list. Selection is an ink wash, not a tint: a filled row out-shouts the state its dot carries.

export const NAV_ROW =
  'flex w-full cursor-pointer items-center gap-snug rounded-md px-gap py-tight text-left outline-none hover:bg-foreground/4 focus-visible:ring-1 focus-visible:ring-ring/60'

export const NAV_ROW_SELECTED = 'bg-primary/10 ring-1 ring-inset ring-primary/20'

// What every control that opens something wears, layout excluded: the surface has three of them
// (a turn card, the subagents group, a thought) and they must all take focus the same way.
export const DISCLOSURE =
  'cursor-pointer text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60'

// A turn is a CARD because its plan and steps belong to it — inset, never a second glass layer. The
// folded past turn is flat as well as quieter: the fall is what says a card is live.
export const TURN_CARD = 'rounded-lg inset-card'

export const TURN_CARD_PAST = 'rounded-lg bg-foreground/2 hover:bg-foreground/4'
