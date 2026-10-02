import { useTranslation } from 'react-i18next'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { EmptyState } from '@/platform/renderer/components/design-system/empty-state'
import { Icon } from '@/platform/renderer/components/icon/icon'
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
      <EmptyState
        action={<HarnessSignInCards harnesses={harnesses} />}
        actionClassName="max-w-lg"
        description={t('empty.description')}
        media={<Icon name="connect" />}
        title={t('empty.title')}
      />
    </main>
  )
}
