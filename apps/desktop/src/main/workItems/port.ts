import type { WorkflowTier, WorkItemView } from '../../shared'

// The Work Item provider port (ADR-0014 / ADR-0018): ONE interface, per-provider adapters
// underneath, every one reached over OAuth + the provider's HTTP API rather than `gh`.
// The READ half only — declaring the write intents here unimplemented would put a capability
// on the interface that no adapter answers.

/**
 * What an adapter can do, stated STATICALLY — before any read, because an affordance must know
 * whether it exists before it knows what to show. A value it reads but cannot establish is a
 * different problem, answered per-fact with an `unknown`/absent rendering.
 */
export interface WorkItemCapabilities {
  canAssign: boolean
  canComment: boolean
  /** How the provider distinguishes completed from abandoned: natively (GitHub's
   * `state_reason`, Linear's state `type`), through per-project configuration (Jira's
   * `resolution`), or not at all — in which case `done` and `closed` cannot be told apart. */
  closureKind: 'native' | 'configured' | 'none'
  /** How much of the canonical five the provider's own workflow carries. A `bare` tier means
   * `in-progress` and `in-review` never appear — they are not synthesized from a running
   * session or an open PR (#167 discipline). */
  tier: WorkflowTier
}

/** Why a read did not happen, in the provider's own terms where it gave any. A failed read is
 * never an empty backlog: the caller keeps what it last fetched at full fidelity. */
export interface WorkItemReadFailure {
  ok: false
  detail: string
}

export type WorkItemRead = { ok: true; items: WorkItemView[] } | WorkItemReadFailure

export interface WorkItemProvider {
  /** Which port implementation this is — half of a Work Item's stored link. */
  readonly id: string
  capabilities(): WorkItemCapabilities
  /** The Project's whole backlog as the provider currently has it. Children come back in the
   * provider's own author order, and every `blockedBy` blocker is verified from the blocker
   * itself rather than from a summary count. */
  read(): Promise<WorkItemRead>
}
