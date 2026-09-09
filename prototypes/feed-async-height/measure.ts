/**
 * The one column width every arm measures at, and the box they all measure in.
 *
 * Every number this rig reports is keyed to that width — a height is a function of the width
 * it was laid out at — so the arms are only comparable while there is exactly one of it.
 */

/** The Feed's prose column, in CSS pixels. Recorded into `results.json` as `columnWidth`. */
export const COLUMN_WIDTH = 600

/**
 * The style both halves of the highlighter arm are drawn under. The arm's entire finding is
 * the height delta between plain `<pre>` and shiki's output, so if the two ever differed here
 * it would be measuring the stylesheet instead.
 */
export const CODE_STYLE = 'margin:0; font: 12px/1.5 ui-monospace, monospace; white-space: pre-wrap'

/** Layout is lazy; nothing is measured until something forces it. */
export const forceLayout = (el: HTMLElement): number => el.getBoundingClientRect().height

/**
 * Runs `body` against a fresh measurement box of the column width, and takes the box out of
 * the document afterwards however `body` ends. Leaving one behind changes what the next arm
 * measures, which is a failure no result would look wrong.
 */
export async function withMeasureBox<T>(
  host: HTMLElement,
  body: (box: HTMLElement) => Promise<T> | T,
): Promise<T> {
  const box = document.createElement('div')
  box.style.width = `${COLUMN_WIDTH}px`
  host.append(box)
  try {
    return await body(box)
  } finally {
    box.remove()
  }
}
