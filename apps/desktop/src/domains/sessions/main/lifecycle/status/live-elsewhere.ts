import type { SessionRosterRow } from '@/domains/sessions/contract/model'

// Another process runs this Session live, read off whatever the Harness itself records (ADR-0040,
// CONTEXT.md L2 · Session). A `managed` row is the one this Argo holds, so nothing observed locks it,
// and a resume can move a Session's id forward, so the record may name a retired id.
export function isLiveElsewhere(row: SessionRosterRow, live: { has: (id: string) => boolean }) {
  return row.posture === 'external' && [row.id, ...row.retiredIds].some((id) => live.has(id))
}
