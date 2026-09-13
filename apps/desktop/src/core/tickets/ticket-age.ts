// How long a Ticket has been open, in the one-unit shorthand a list column can hold.
const UNITS = [
  { seconds: 365 * 86_400, short: 'y', long: 'year' },
  { seconds: 30 * 86_400, short: 'mo', long: 'month' },
  { seconds: 7 * 86_400, short: 'w', long: 'week' },
  { seconds: 86_400, short: 'd', long: 'day' },
  { seconds: 3_600, short: 'h', long: 'hour' },
  { seconds: 60, short: 'm', long: 'minute' },
] as const

export type TicketAge = { short: string; long: string }

export function ticketAge(createdAt: string, now: number): TicketAge {
  const elapsed = Math.max(0, (now - Date.parse(createdAt)) / 1000)
  const unit = UNITS.find((candidate) => elapsed >= candidate.seconds)
  if (!unit) return { short: 'now', long: 'Opened just now' }
  const amount = Math.floor(elapsed / unit.seconds)
  const plural = amount === 1 ? '' : 's'
  return { short: `${amount}${unit.short}`, long: `Opened ${amount} ${unit.long}${plural} ago` }
}
