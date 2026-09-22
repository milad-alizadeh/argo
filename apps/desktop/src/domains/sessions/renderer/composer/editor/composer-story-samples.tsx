// Shared across three or more Composer stories files. A one-off helper stays beside its story
// instead of here (house rule: a helper hoists on the third caller).
import { useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model'
import { Button } from '@/platform/renderer/components/ui/button'
import { SessionComposer, type SessionComposerProps } from './session-composer'

export function ComposerStory({
  onSend,
  plan = null,
}: {
  onSend: SessionComposerProps['onSend']
  plan?: SessionPlan | null
}) {
  const [sessionId, setSessionId] = useState('session-one')

  return (
    <>
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setSessionId('session-one')} type="button" variant="outline">
          Session one
        </Button>
        <Button onClick={() => setSessionId('session-two')} type="button" variant="outline">
          Session two
        </Button>
      </div>
      <SessionComposer onSend={onSend} plan={plan} sessionId={sessionId} />
    </>
  )
}
