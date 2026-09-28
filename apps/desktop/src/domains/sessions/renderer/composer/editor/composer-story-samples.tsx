// Shared across three or more Composer stories files. A one-off helper stays beside its story
// instead of here (house rule: a helper hoists on the third caller).
import { useCallback, useState } from 'react'
import type { SessionPlan } from '@/domains/sessions/renderer/model/models'
import { Button } from '@/platform/renderer/components/ui/button'
import type { ComposerEditing } from '../editing/composer-editing'
import { ComposerForm, type ComposerFormProps } from '../layout/composer-form'

export function ComposerStory({
  onSend,
  plan = null,
}: {
  onSend: ComposerFormProps['onSend']
  plan?: SessionPlan | null
}) {
  const [sessionId, setSessionId] = useState('session-one')
  const [drafts, setDrafts] = useState(() => new Map<string, ComposerEditing>())
  const rememberEditing = useCallback(
    (editing: ComposerEditing) =>
      setDrafts((current) => {
        if (current.get(sessionId) === editing) return current
        return new Map(current).set(sessionId, editing)
      }),
    [sessionId],
  )

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
      <ComposerForm
        initialEditing={drafts.get(sessionId)}
        onEditingChange={rememberEditing}
        onSend={onSend}
        plan={plan}
        sessionId={sessionId}
      />
    </>
  )
}
