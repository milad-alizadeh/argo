import { useTranslation } from 'react-i18next'
import { readDelegation } from '../../../../core/sessions/delegation'
import type { Session } from '../types'
import { FinishedDisclosure } from './FinishedDisclosure'
import { InspectorRow } from './InspectorRow'
import { InspectorSection } from './InspectorSection'

// The inspector shows only work under the selected Session. Finished Subagents stay behind the
// disclosure, and a command remains a shell row rather than becoming an Agent (#1907).
export function AgentsRail({ session }: { session: Session }) {
  const { t } = useTranslation()
  const reading = readDelegation(session.status, session.delegations)
  const open = session.delegations.filter((delegation) => !delegation.landed).length
  const running = reading.known ? reading.running : []
  const unresolved = reading.known ? reading.unresolved : open
  const agentsLabel = reading.known
    ? t('rail.agents', { count: running.length })
    : t('rail.agentsUnknown')

  return (
    <div className="agents-rail min-h-0 flex-1 overflow-y-auto">
      <InspectorSection label={agentsLabel}>
        {running.map((delegation, index) => (
          <InspectorRow key={delegation.id} status="running">
            {delegation.label ?? t('rail.subagent', { index: index + 1 })}
          </InspectorRow>
        ))}
        {unresolved === 0 ? null : (
          <InspectorRow status="unknown">
            {t('rail.unresolved', { count: unresolved })}
          </InspectorRow>
        )}
      </InspectorSection>
      {session.shell.length === 0 ? null : (
        <InspectorSection label={t('rail.shell', { count: session.shell.length })}>
          {session.shell.map((command) => (
            <InspectorRow key={command.id} monospace outlined status="running">
              {command.command ?? t('rail.shellBare')}
            </InspectorRow>
          ))}
        </InspectorSection>
      )}
      <FinishedDisclosure session={session} />
    </div>
  )
}
