import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import {
  type ManagedRosterSeed,
  managedRosterRow,
} from '@/domains/sessions/contract/observation/roster-row-definition'

// The row a managed Session stands on before its Harness writes history.
export function managedRow(id: string, session: ManagedRosterSeed['session']): SessionRosterRow {
  return managedRosterRow({ id, session: { ...session, plan: session.plan ?? null } })
}
