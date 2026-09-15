// The pair of buttons the Session header carries: one for Subagents, one for background Shells
// (#1582). A Session that ran neither draws neither, so a screen with no background work has no
// header control at all.
import { Bot, SquareTerminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SessionDelegation, SessionShellCommand } from '@/core/sessions/models'
import { SessionWorkMenu } from './SessionWorkMenu'
import { delegationEntries, shellEntries } from './session-work-entries'

export function SessionWorkButtons({
  delegations,
  delegationTokens,
  now,
  onSelectDelegation,
  onSelectShell,
  selectedDelegationId,
  selectedShellId,
  shell,
}: {
  delegations: readonly SessionDelegation[]
  // What each Subagent spent, keyed by the call that spawned it. A Subagent whose transcript has
  // not been read yet is simply absent, and its row then shows no token figure at all.
  delegationTokens?: Readonly<Record<string, number | null>>
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
        entries={delegationEntries(delegations, { now: clock, tokens: delegationTokens ?? {} }, t)}
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
