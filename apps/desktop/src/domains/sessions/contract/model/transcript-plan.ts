import type { PlanEntryStatus } from '@/domains/sessions/contract/model/models'

// One change a record makes to its Session's Plan (CONTEXT.md L3 · Plan), as its adapter read it.
export type PlanChange =
  | { kind: 'replace'; entries: { content: string; status: PlanEntryStatus }[] }
  | { kind: 'unreadable' }
  // A step exists only once the result of the call that added it names the step's key.
  | { kind: 'add'; callId: string; content: string }
  | { kind: 'added'; callId: string; key: string }
  | { kind: 'update'; key: string; content: string | null; status: PlanEntryStatus | null }
  | { kind: 'remove'; key: string }
