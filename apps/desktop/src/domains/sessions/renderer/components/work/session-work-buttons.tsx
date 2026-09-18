// The pair of buttons the Session header carries: one for Subagents, one for background Shells
// (#1582). A Session that ran neither draws neither, so a screen with no background work has no
// header control at all.
import { Bot, SquareTerminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DelegationUsageFacts } from '@/domains/sessions/contract/background-work-contract'
import type { SessionDelegation, SessionShellCommand } from '@/domains/sessions/contract/models'
import { delegationEntries, shellEntries } from './session-work-entries'
import { SessionWorkMenu } from './session-work-menu'

export function SessionWorkButtons({
  delegations,
  delegationUsage,
  now,
  onSelectDelegation,
  onSelectShell,
  selectedDelegationId,
  selectedShellId,
  shell,
}: {
  delegations: readonly SessionDelegation[]
  // The recorded facts for each Subagent, keyed by the call that spawned it.
  delegationUsage?: Readonly<Record<string, DelegationUsageFacts>>
  // The clock a running entry is measured against. Passed in so a story draws a fixed duration.
  now?: number
  onSelectDelegation: (delegationId: string) => void
  onSelectShell: (shellId: string) => void
  selectedDelegationId: string | null
  selectedShellId: string | null
  shell: readonly SessionShellCommand[]
}) {
  const { t } = useTranslation('sessions')
  const clock = now ?? Date.now()
  return (
    <>
      <SessionWorkMenu
        entries={delegationEntries(delegations, { now: clock, usage: delegationUsage ?? {} }, t)}
        icon={Bot}
        label="Subagents"
        onSelect={onSelectDelegation}
        selectedId={selectedDelegationId}
      />
      <SessionWorkMenu
        entries={shellEntries(shell, clock, t)}
        icon={SquareTerminal}
        label="Shell"
        onSelect={onSelectShell}
        selectedId={selectedShellId}
      />
    </>
  )
}
