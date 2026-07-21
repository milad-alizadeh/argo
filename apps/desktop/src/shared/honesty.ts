// The provenance grade of any field the cockpit renders (CONTEXT.md, ADR-0008).
// DIRECT = clean from transcript/git, zero inference; DERIVED = computed/estimated
// with a marked fallback; CONVENTION = plugin-owned over the MCP channel. Nothing is
// FABRICATED: a field the transcript does not carry is omitted or DERIVED, never invented.

export const TIERS = ['direct', 'derived', 'convention'] as const

export type Tier = (typeof TIERS)[number]

export interface Tiered<T> {
  readonly value: T
  readonly tier: Tier
}

export const direct = <T>(value: T): Tiered<T> => ({ value, tier: 'direct' })
export const derived = <T>(value: T): Tiered<T> => ({ value, tier: 'derived' })
export const convention = <T>(value: T): Tiered<T> => ({ value, tier: 'convention' })
