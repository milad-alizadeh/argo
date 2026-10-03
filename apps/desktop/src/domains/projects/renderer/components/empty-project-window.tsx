import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Button } from '@/platform/renderer/components/ui/button'

// Every app surface reads one Project, so with none selected there is no roster to show: the
// window names the one next step instead (#2307).
export function EmptyProjectWindow({ busy, onAdd }: { busy: boolean; onAdd: () => void }) {
  const { t } = useTranslation('projects')
  return (
    <main aria-label={t('empty.label')} className="panel-frame" data-component="EmptyProjectWindow">
      <div className="panel-window-chrome" />
      <EmptyState
        action={
          <Button disabled={busy} onClick={onAdd}>
            {t('empty.add')}
          </Button>
        }
        description={t('empty.description')}
        media={<Icon name="new-project" />}
        title={t('empty.title')}
      />
    </main>
  )
}
