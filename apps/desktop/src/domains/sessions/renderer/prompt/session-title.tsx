import { harnessOrDefault } from '@/harnesses/harness'
import { SessionReferenceText } from '../composer/references'
import type { Session } from '../types'
import { PromptText } from './prompt-text'

export function SessionTitle({
  session,
  text,
}: {
  session: Pick<Session, 'harness'>
  text: string
}) {
  return (
    <PromptText
      interactiveLinks={false}
      renderText={(value) => (
        <SessionReferenceText harness={harnessOrDefault(session.harness)} text={value} />
      )}
      text={text}
    />
  )
}
