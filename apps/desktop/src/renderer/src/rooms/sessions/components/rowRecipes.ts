// The Activity list's row recipes. Every row in the navigation pane — a subagent, a tool step —
// wears the same box and the same selected wash, so extracting them here is what keeps the two
// sections reading as one list. Selection is an ink wash rather than a tint: gold is the attention
// ink, and a filled row would out-shout the state a dot is carrying.

export const NAV_ROW =
  'flex w-full cursor-pointer items-center gap-snug rounded-md px-gap py-tight text-left outline-none hover:bg-foreground/4 focus-visible:ring-1 focus-visible:ring-ring/60'

export const NAV_ROW_SELECTED = 'bg-primary/10 ring-1 ring-inset ring-primary/20'

// A turn is a CARD in the list, not a run of loose rows: its plan and its steps belong to it, and a
// box is what says so. Flat and inset with a lit lip — the panel around it already carries the one
// frosted surface, so a second glass layer here would be glass on glass. The folded past turn sits
// one step quieter than the open one, which is the whole difference between them.
export const TURN_CARD = 'rounded-lg bg-foreground/3 inset-lip'

export const TURN_CARD_PAST = 'rounded-lg bg-foreground/2 hover:bg-foreground/4'
