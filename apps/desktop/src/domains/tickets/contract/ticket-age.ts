import { formatDistanceStrict, min } from 'date-fns'

export type TicketAge = { short: string; long: string }

// How long a Ticket has been open; a clock behind GitHub's reads a Ticket from the future as just opened.
export function ticketAge(createdAt: string, now: number): TicketAge {
  const opened = min([createdAt, now])
  const options = { roundingMethod: 'floor' } as const
  if (now - opened.getTime() < 60_000) return { short: 'opened just now', long: 'Opened just now' }
  const age = formatDistanceStrict(opened, now, { ...options, addSuffix: true })
  return {
    short: `opened ${age}`,
    long: `Opened ${age}`,
  }
}
