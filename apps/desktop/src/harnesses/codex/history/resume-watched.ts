import { beginWatchedResume as begin } from '@/harnesses/composition/begin-watched-resume'

export const LEASE_REFUSAL = 'Another Argo window is driving this Codex Session.'

// Vendor liveness, then the SQLite lease, and only then a managed channel (#2581).
export const beginWatchedResume = (
  options: Omit<Parameters<typeof begin>[0], 'leaseRefusal' | 'openFailure'>,
) =>
  begin({
    ...options,
    leaseRefusal: LEASE_REFUSAL,
    openFailure: 'Codex refused to resume this Session.',
  })
