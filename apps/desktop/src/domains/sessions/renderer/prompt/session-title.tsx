import { SessionReferenceText } from '../composer/references'
import { sessionHarnessOf } from '../harness'
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
        <SessionReferenceText harness={sessionHarnessOf(session)} text={value} />
      )}
      text={text}
    />
  )
}
