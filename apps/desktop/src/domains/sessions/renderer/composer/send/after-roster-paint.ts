export function afterRosterPaint(): Promise<void> {
  if (typeof requestAnimationFrame === 'undefined') return Promise.resolve()
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}
