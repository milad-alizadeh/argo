// Shared across three or more Composer stories files. A one-off helper stays beside its story
// instead of here (house rule: a helper hoists on the third caller).
import { useCallback, useState } from 'react'
import type { ComposerCommandListing } from '@/domains/sessions/api/composer-commands'
import { Button } from '@/platform/renderer/components/ui/button'
import type { SessionPlan } from '../../model/models'
import type { ComposerEditing } from '../editing/composer-editing'
import { ComposerForm, type ComposerFormProps } from '../layout/composer-form'
import type { TicketChoice } from '../references/context-picker/context-picker-contents'

export const STORY_COMMANDS: ComposerCommandListing = {
  availability: 'listed',
  commands: [
    {
      name: 'implement',
      description: 'Build an approved ticket',
      argumentHint: '',
      aliases: [],
    },
  ],
}

export const STORY_TICKETS: readonly TicketChoice[] = [
  {
    provider: 'linear',
    key: 'ENG-42',
    title: 'Keep the Composer draft in sync',
    status: 'In Progress',
    terminal: false,
    blocked: true,
  },
  {
    provider: 'linear',
    key: 'ENG-9',
    title: 'Store the refresh token',
    status: 'Done',
    terminal: true,
    blocked: null,
  },
]

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
        tickets={STORY_TICKETS}
      />
    </>
  )
}
