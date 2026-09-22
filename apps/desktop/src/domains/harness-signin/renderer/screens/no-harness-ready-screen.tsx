import { PlugZap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { HarnessSignInCards } from '../components/harness-sign-in-cards'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'

// Nothing in the cockpit can run a Session with no Harness signed in, so this replaces the whole
// window rather than sitting inside the Roster (#2579, gated the way `EmptyProjectScreen` is).
export function NoHarnessReadyScreen({ harnesses }: { harnesses: HarnessReadiness[] }) {
  const { t } = useTranslation('harnessSignIn')
  return (
    <main
      aria-label={t('empty.title')}
      className="flex h-full min-h-0 flex-col bg-background"
      data-component="NoHarnessReadyScreen"
    >
      <div className="drag-region h-(--size-chrome-bar) shrink-0" />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PlugZap aria-hidden="true" />
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
