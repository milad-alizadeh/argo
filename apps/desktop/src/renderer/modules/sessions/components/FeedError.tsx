import { CircleAlertIcon, RefreshCwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'

export function FeedError({ failure, onReread }: { failure: string; onReread: () => void }) {
  const { t } = useTranslation()
  return (
    <Empty className="h-full" data-component="FeedError" role="alert">
      <EmptyHeader>
        <EmptyMedia className="text-destructive" variant="icon">
          <CircleAlertIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('errors.feed')}</EmptyTitle>
        <EmptyDescription className="font-mono text-control">{failure}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onReread} variant="outline">
          <RefreshCwIcon aria-hidden="true" />
          {t('readAgain')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
