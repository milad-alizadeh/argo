import { useTranslation } from 'react-i18next'
import { harnessOrDefault } from '@/harnesses/harness'
import { SessionReferenceText } from '../composer/references'
import type { Session } from '../types'
import { PromptText } from './prompt-text'

// The words a Session's title reads as, for a label or an accessible name.
export function useSessionTitleText(name: string | null): string {
  const { t } = useTranslation('sessions')
  return name ?? t('untitledSession')
}

// A Session nothing names draws a muted placeholder, which is never stored as its name.
export function SessionTitle({ session }: { session: Pick<Session, 'harness' | 'name'> }) {
  const shown = useSessionTitleText(session.name)
  if (session.name === null) return <span className="text-muted-foreground">{shown}</span>
  return (
    <PromptText
      interactiveLinks={false}
      renderText={(value) => (
        <SessionReferenceText harness={harnessOrDefault(session.harness)} text={value} />
      )}
      text={session.name}
    />
  )
}
