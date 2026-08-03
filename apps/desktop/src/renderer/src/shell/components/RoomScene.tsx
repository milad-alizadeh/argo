/**
 * Organism: the ONE lit scene the whole cockpit floats on.
 *
 * Every plane in the app carries a cove lip and a warm bloom "as if the orb lit it" — but nothing
 * was painting the light those effects imply, so the planes read as unmotivated gradients on flat
 * black and the app read flat. This is the source: the orb's corona off-centre right, a wider warm
 * wash behind it, a cool fill in the corner the corona does not reach, and a lift along the top,
 * with the dust scrim as a second pass pulling the edges down.
 *
 * It is a FIXED backdrop at `-z-10`, so it spans every room, survives every scroll, and is covered
 * by nothing: the shell root and the top bar are deliberately transparent. The shell owns it rather
 * than each room because the light does not change when you change rooms — one scene, one source.
 */
export function RoomScene(): React.JSX.Element {
  return (
    <div aria-hidden className="-z-10 fixed inset-0 room-scene">
      {/* The scrim is its own layer rather than more stops on the scene: it MULTIPLIES the edges
          down, which a stop in the same gradient stack cannot do. */}
      <span className="absolute inset-0 room-scrim" />
      {/* The dither, last and over everything: a ramp this shallow across a whole window bands at
          8 bits no matter how smooth the maths is, and grain is what breaks the steps. */}
      <span className="absolute inset-0 room-grain" />
    </div>
  )
}
