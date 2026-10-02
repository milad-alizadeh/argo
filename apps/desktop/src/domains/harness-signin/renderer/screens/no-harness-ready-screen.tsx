import { useTranslation } from 'react-i18next'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import { HarnessSignInCards } from '../components'

// Nothing in the app can run a Session with no Harness signed in, so this replaces the whole
// window rather than sitting inside the Roster (#2579, gated the way `EmptyProjectScreen` is).
export function NoHarnessReadyScreen({ harnesses }: { harnesses: HarnessReadiness[] }) {
  const { t } = useTranslation('harnessSignIn')
  return (
    <main
      aria-label={t('empty.title')}
      className="panel-frame"
      data-component="NoHarnessReadyScreen"
    >
      <div className="panel-window-chrome" />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="connect" />
          </EmptyMedia>
          <EmptyTitle>{t('empty.title')}</EmptyTitle>
          <EmptyDescription>{t('empty.description')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="max-w-lg">
          <HarnessSignInCards harnesses={harnesses} />
        </EmptyContent>
      </Empty>
    </main>
  )
}
