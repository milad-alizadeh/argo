export function readCssSize(token: string): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token))
}
