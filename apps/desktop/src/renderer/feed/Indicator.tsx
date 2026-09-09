// The provisional state the deck stands in until the measure pass completes (ADR-0033 · The
// activity indicator). A `div` animating `transform` and `opacity` only, so the animation lives
// on the compositor and keeps ticking through a blocked main thread. Nothing here reads its
// computed style or touches its playback: either would cancel the compositor animation and start
// a new one, which needs the main thread that is blocked.
export function Indicator({ standing, busy }: { standing: string; busy: boolean }) {
  return (
    <div className="indicator" role="status" aria-live="polite">
      {busy ? <div className="indicator__pulse" aria-hidden="true" /> : null}
      <p className="indicator__standing">{standing}</p>
    </div>
  )
}
