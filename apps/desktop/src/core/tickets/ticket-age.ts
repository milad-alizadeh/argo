import { type FormatDistanceToken, formatDistanceStrict, type Locale, min } from 'date-fns'
import { enUS } from 'date-fns/locale'

// The one-letter unit a list column can hold; the strict distance names only these units.
const COMPACT_UNITS: Partial<Record<FormatDistanceToken, string>> = {
  xMinutes: 'm',
  xHours: 'h',
  xDays: 'd',
  xMonths: 'mo',
  xYears: 'y',
}

const compact: Locale = {
  ...enUS,
  formatDistance: (token, count) => {
    const unit = COMPACT_UNITS[token]
    return unit ? `${count}${unit}` : 'now'
  },
}

export type TicketAge = { short: string; long: string }

// How long a Ticket has been open; a clock behind GitHub's reads a Ticket from the future as just opened.
export function ticketAge(createdAt: string, now: number): TicketAge {
  const opened = min([createdAt, now])
  const options = { roundingMethod: 'floor' } as const
  const short = formatDistanceStrict(opened, now, { ...options, locale: compact })
  if (short === 'now') return { short, long: 'Opened just now' }
  return {
    short,
    long: `Opened ${formatDistanceStrict(opened, now, { ...options, addSuffix: true })}`,
  }
}
