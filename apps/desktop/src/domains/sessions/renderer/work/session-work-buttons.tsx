// The pair of buttons the Session header carries: one for Subagents, one for background Shells
// (#1582). A Session that ran neither draws neither, so a screen with no background work has no
// header control at all.
import { useTranslation } from 'react-i18next'
import type { SessionShellCommand, SessionSubagent } from '@/domains/sessions/renderer/model/models'
import type { SubagentUsageFacts } from '@/domains/sessions/renderer/work/types'
import { delegationEntries, shellEntries } from './session-work-entries'
import { SessionWorkMenu } from './session-work-menu'

export function SessionWorkButtons({
  subagents,
  subagentUsage,
  now,
  onSelectDelegation,
  onSelectShell,
  selectedDelegationId,
  selectedShellId,
  shell,
}: {
  subagents: readonly SessionSubagent[]
  // The recorded facts for each Subagent, keyed by the call that spawned it.
  subagentUsage?: Readonly<Record<string, SubagentUsageFacts>>
  // The clock a running entry is measured against. Passed in so a story draws a fixed duration.
  now?: number
  onSelectDelegation: (subagentId: string) => void
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
        entries={delegationEntries(subagents, { now: clock, usage: subagentUsage ?? {} }, t)}
        icon="agent"
        label="Subagents"
        onSelect={onSelectDelegation}
        selectedId={selectedDelegationId}
      />
      <SessionWorkMenu
        entries={shellEntries(shell, clock, t)}
        icon="tool-terminal"
        label="Shell"
        onSelect={onSelectShell}
        selectedId={selectedShellId}
      />
    </>
  )
}
