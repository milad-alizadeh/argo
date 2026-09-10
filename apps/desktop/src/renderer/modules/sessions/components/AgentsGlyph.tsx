// Delegation, as the layout prototype draws it (`roster-row-signals-prototype.html` · SVG.agents):
// a stem that forks. It is not the branch glyph, because git's branch is a different fact.
export function AgentsGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-[11px] flex-none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.4"
      viewBox="0 0 16 16"
    >
      <path d="M4 13.2V6.4a2 2 0 0 1 2-2h6" />
      <circle cx="4" cy="14.4" r="1.4" />
      <path d="M12.6 4.4 10.6 2.4M12.6 4.4l-2 2" />
      <path d="M7.6 13.2a2 2 0 0 1 2-2h3" />
    </svg>
  )
}
