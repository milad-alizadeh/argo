// The whole-document measure pass of ADR-0033 rule 3: every row of the reading gets a final
// height at the current width before anything is drawn. Nothing is estimated and no height is
// corrected on scroll.

export const ROW_ATTRIBUTE = 'data-feed-row'

// The container carries `content-visibility: hidden`, the spec's own sanctioned measurement
// technique (css-contain-2 §4.2). Size containment makes the CONTAINER measure 0 px, so only the
// rows inside it may be read — confirmed in Electron 44's Chromium, where a hidden row and the
// same row shown both measured 76 px and the container measured 0.
export function readRowHeights(container: HTMLElement): Map<string, number> {
  const heights = new Map<string, number>()
  for (const row of container.querySelectorAll(`[${ROW_ATTRIBUTE}]`)) {
    const id = row.getAttribute(ROW_ATTRIBUTE)
    // The exact box rather than the rounded one. A height read to the pixel and then written
    // back is a fraction of a pixel of drift per row, and the Feed is drawn from the sum of them.
    if (id !== null && row instanceof HTMLElement)
      heights.set(id, row.getBoundingClientRect().height)
  }
  return heights
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

// The indicator reaches the compositor only through a full commit and then tile activation, so
// it is given a few frames to run before the pass begins (ADR-0033 · The activity indicator). A
// layer whose tiles are not yet rastered aborts on checkerboarding, and the recovery path asks
// for a main frame that a blocked main thread cannot serve.
const WARM_FRAMES = 3

// The pass is one task rather than many. Rule 3 leaves the choice free, and the reads here are a
// single forced layout followed by N height reads with no writes between them, so chunking would
// buy nothing and cost the yield points a reader could see a half-settled document through.
// Two numbers, because one cannot answer both questions #1863 asks. `measuredMs` is the pass: the
// forced layout and the height reads, which is the cost that grows with the Feed. `settledMs` is
// what the reader waits, and it carries the warm frames and the font wait as well — a floor of
// roughly three frames that is there whether the Session holds six rows or six hundred. Timing
// them together reports the floor as if it were the layout.
export async function settleReading(container: HTMLElement) {
  const opened = performance.now()
  for (let frame = 0; frame < WARM_FRAMES; frame += 1) await nextFrame()
  // A face arriving after the pass moves a settled paragraph (ADR-0035), so the pass waits.
  await document.fonts.ready
  const started = performance.now()
  const heights = readRowHeights(container)
  const finished = performance.now()
  return { heights, measuredMs: finished - started, settledMs: finished - opened }
}

// Read off the measurement container rather than the column around it. The container reserves a
// scrollbar gutter exactly as the viewport does, so its content box is the width the shown rows
// get; the column is wider than both by that gutter wherever the platform draws one.
export function containerReading(container: HTMLElement) {
  const style = getComputedStyle(container)
  return {
    width: container.clientWidth,
    // The CSS font shorthand the prose rows inherit. `font` collapses family, size, weight and
    // line height into one string, which is what rule 6 calls "font" for every row that inherits
    // it. A row that sets its own face — the code row, off `--family-code` — is not in this
    // string, so a face changed for code alone would not invalidate the reading. Both faces move
    // together today, from `tokens.css`; the day one moves alone, it belongs in the key.
    font: style.font,
    zoom: window.argo.zoomFactor(),
  }
}
