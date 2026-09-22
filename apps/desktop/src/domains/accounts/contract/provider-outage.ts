// The provider itself is unreachable or throttled, independent of whichever Argo contract is
// asking, so this text is the same one fact both the Account and Ticket contracts report.
export const PROVIDER_OUTAGE_ERRORS = {
  'github-unreachable': 'Argo cannot reach GitHub.',
  'rate-limited': 'GitHub is limiting requests. Try again in a few minutes.',
  'linear-unreachable': 'Argo cannot reach Linear.',
  'linear-rate-limited': 'Linear is limiting requests. Try again in a few minutes.',
} as const
