export const ROW_CARETS = ['open', 'closed', 'reserved'] as const

/** How a row shows disclosure. `reserved` holds the caret's width without drawing one, so
 * a row with nothing to open still lines its name up with its siblings. */
export type RowCaret = (typeof ROW_CARETS)[number]

/** The caret for a row that discloses children: nothing to open reserves the width rather
 * than drawing a dead button, so every sibling's name starts at the same x. */
export function rowCaret({ hasContent, open }: { hasContent: boolean; open: boolean }): RowCaret {
  if (!hasContent) return 'reserved'
  return open ? 'open' : 'closed'
}
