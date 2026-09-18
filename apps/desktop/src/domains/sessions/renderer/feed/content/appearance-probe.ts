// The colour a value draws as, in the form `getComputedStyle` reports it.
export function drawnColor(value: string) {
  const probe = document.createElement('span')
  probe.style.color = value
  document.body.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

// The colours a set of role classes draws in the current appearance.
export function roleColors(className: string) {
  const probe = document.createElement('span')
  probe.className = className
  document.body.append(probe)
  const { color, backgroundColor } = getComputedStyle(probe)
  probe.remove()
  return { color, backgroundColor }
}
