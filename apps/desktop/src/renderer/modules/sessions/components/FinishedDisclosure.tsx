import { CheckCircleIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../components/ui/collapsible'
import type { Session } from '../types'
import { InspectorRow } from './InspectorRow'

export function FinishedDisclosure({ session }: { session: Session }) {
  const { t } = useTranslation()
  const finished = session.delegations.filter((delegation) => delegation.landed)
  if (finished.length === 0) return null

  return (
    <Collapsible data-component="FinishedDisclosure">
      <CollapsibleTrigger className="group session-page__finished-trigger">
        <CheckCircleIcon aria-hidden="true" className="size-(--size-icon-control)" />
        {t('rail.finished', { count: finished.length })}
        <ChevronRightIcon
          aria-hidden="true"
          className="size-(--size-icon-meta) transition-transform group-data-[panel-open]:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="px-(--spacing-shell-inset) pb-(--spacing-shell-item)">
          {finished.map((delegation, index) => (
            <InspectorRow key={delegation.id} status="ended">
              {delegation.label ?? t('rail.subagent', { index: index + 1 })}
            </InspectorRow>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
