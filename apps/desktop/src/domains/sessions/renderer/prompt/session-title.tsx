import { SessionReferenceText } from '../composer/references/session-reference'
import { sessionHarnessOf } from '../harness/harnesses'
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
