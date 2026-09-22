// Shared across three or more Composer stories files. A one-off helper stays beside its story
// instead of here (house rule: a helper hoists on the third caller).
import { useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/contract/model/models'
import { SessionComposer } from '@/domains/sessions/renderer/composer/session-composer'
import { Button } from '@/platform/renderer/components/ui/button'

export function ComposerStory({ plan = null }: { plan?: SessionPlan | null }) {
  const [sessionId, setSessionId] = useState('session-one')
  const [sent, setSent] = useState<string | null>(null)

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
      <SessionComposer
        onSend={async (text, _setup, attachments) => {
          const refs = attachments.map(({ path }) => `@${path}`).join(' ')
          setSent(refs.length > 0 ? `${text} ${refs}`.trim() : text)
          return true
        }}
        plan={plan}
        sessionId={sessionId}
      />
      <output className="mt-4 block type-body" data-testid="sent-message">
        {sent}
      </output>
    </>
  )
}
