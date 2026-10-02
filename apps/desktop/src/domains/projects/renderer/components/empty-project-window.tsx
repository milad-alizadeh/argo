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

// Every app surface reads one Project, so with none selected there is no roster to show: the
// window names the one next step instead (#2307).
export function EmptyProjectWindow({ busy, onAdd }: { busy: boolean; onAdd: () => void }) {
  const { t } = useTranslation('projects')
  return (
    <main aria-label={t('empty.label')} className="panel-frame" data-component="EmptyProjectWindow">
      <div className="panel-window-chrome" />
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
