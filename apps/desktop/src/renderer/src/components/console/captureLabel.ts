/** The ONE format a capture tab reads in. A capture is time-keyed raw I/O, so its label
 * carries the moment it was captured — that is what tells two runs of the same tool apart.
 * 24-hour and zero-padded rather than locale-formatted: the tab is a fixed-width column. */
export function captureLabel(name: string, at: Date): string {
  const hours = String(at.getHours()).padStart(2, '0')
  const minutes = String(at.getMinutes()).padStart(2, '0')
  return `${name} @${hours}:${minutes}`
}
