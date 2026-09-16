export function contextZone(percentage: number) {
  if (percentage <= 20) return { label: 'Smart Zone', text: 'text-emerald-600' }
  if (percentage <= 40) return { label: 'Nearing Dumb Zone', text: 'text-amber-600' }
  return { label: 'Dumb Zone', text: 'text-red-600' }
}
