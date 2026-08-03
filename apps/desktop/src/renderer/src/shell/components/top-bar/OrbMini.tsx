/**
 * Molecule: the Concierge, drawn as a lit ring around a dark core.
 *
 * Deliberately cheap CSS rather than a WebGL scene: this orb is permanent chrome in all three
 * rooms, so it has to cost nothing on a low-spec machine. `idle` is its only v1 state — the
 * state set that makes it expressive belongs to the voice-concierge map (issue 190), and
 * it holds no animation because the screen's one motion budget belongs to live status.
 */
export function OrbMini(): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-component="OrbMini"
      className="relative grid size-project-tab shrink-0 place-items-center"
    >
      <span className="absolute inset-0 rounded-full border border-primary/70 text-primary glow" />
      <span className="absolute inset-snug rounded-full bg-background inset-lip" />
    </span>
  )
}
