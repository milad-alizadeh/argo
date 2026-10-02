export function contextZone(percentage: number) {
  if (percentage < 20) return { label: 'Smart Zone', text: 'text-status-success' }
  return { label: 'Dumb Zone', text: 'text-destructive' }
}
