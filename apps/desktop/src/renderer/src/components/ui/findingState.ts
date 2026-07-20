// The review-finding vocabulary, shared by the chip that reports the state (StateChip)
// and the control that advances it (AddressButton) so the cycle is spelled once.
export const FINDING_STATES = ['open', 'addressing', 'fixed'] as const

/** Where a review finding stands: open → addressing → fixed, and back to open on reopen. */
export type FindingState = (typeof FINDING_STATES)[number]
