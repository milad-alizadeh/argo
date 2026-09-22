import { useTranslation } from 'react-i18next'

import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'

// Every cockpit surface reads one Project, so with none selected there is no roster to show: the
// window names the one next step instead (#2307).
export function EmptyProjectWindow({ busy, onAdd }: { busy: boolean; onAdd: () => void }) {
  const { t } = useTranslation('projects')
  return (
    <main
      aria-label={t('empty.label')}
      className="flex h-full min-h-0 flex-col bg-background"
      data-component="EmptyProjectWindow"
    >
      <div className="drag-region h-(--size-chrome-bar) shrink-0" />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="new-project" />
          </EmptyMedia>
          <EmptyTitle>{t('empty.title')}</EmptyTitle>
          <EmptyDescription>{t('empty.description')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button disabled={busy} onClick={onAdd}>
            {t('empty.add')}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
