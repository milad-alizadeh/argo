export function contextZone(percentage: number) {
  if (percentage <= 20) return { label: 'Smart Zone', text: 'text-success' }
  if (percentage <= 40) return { label: 'Nearing Dumb Zone', text: 'text-warn' }
  return { label: 'Dumb Zone', text: 'text-destructive' }
}
