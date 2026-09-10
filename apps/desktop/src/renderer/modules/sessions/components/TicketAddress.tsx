// The Ticket's own mark (`cockpit-roster-row.html` · SVG.ticket, ArgoSymbol.ticketsRoom). It
// differs from the pull request's mark in SHAPE, so the two addresses on line 3 are told apart
// without a word.
function TicketGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-[12px] flex-none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 16 16"
    >
      <path d="M2.3 5 3.5 6.2 5.9 3.6" />
      <path d="M8.4 5h5.3" />
      <path d="M2.6 11h3.3" />
      <path d="M8.4 11h5.3" />
    </svg>
  )
}

// The Ticket this run answers to, on line 3 beside the pull request (`cockpit-roster-row.html` ·
// DeliveryAddresses). Both addresses keep the `#`: the mark says which space the number lives in
// and the hash says it is a number at all. A Ticket is an address and nothing more, so it carries
// no state ink; a pull request is an address with a state.
//
// Nothing reads a Ticket number yet: the Ticket rooms (Linear, GitHub Issues) are a later slice,
// and this is the address the row will draw once one of them is read. So the row takes it as an
// argument and no reading passes one (#1907).
export function TicketAddress({ ticket }: { ticket: number }) {
  return (
    <span className="roster__ticket inline-flex flex-none items-center gap-tight font-mono text-meta text-faint">
      <TicketGlyph />#{ticket}
    </span>
  )
}
