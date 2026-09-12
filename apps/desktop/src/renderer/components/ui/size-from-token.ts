export function sizeFromToken(token: string) {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token))
}
