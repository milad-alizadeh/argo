// The Activity list's row recipes. Every row in the navigation pane — a subagent, a tool step —
// wears the same box and the same selected wash, so extracting them here is what keeps the two
// sections reading as one list. Selection is an ink wash rather than a tint: gold is the attention
// ink, and a filled row would out-shout the state a dot is carrying.

export const NAV_ROW =
  'flex w-full cursor-pointer items-center gap-snug rounded-md px-gap py-tight text-left outline-none hover:bg-foreground/4 focus-visible:ring-1 focus-visible:ring-ring/60'

export const NAV_ROW_SELECTED = 'bg-primary/10 ring-1 ring-inset ring-primary/20'
