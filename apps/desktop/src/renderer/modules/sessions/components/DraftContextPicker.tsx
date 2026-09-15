import { $createTextNode, $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical'
import type { RefObject } from 'react'

import type { ComposerTicketContext } from '../state/useComposerStore'
import { $createComposerTicketReferenceNode } from './ComposerTicketReferenceNode'
import { ContextPicker } from './ContextPicker'
import { activeReference } from './composer-reference-menu'

export function DraftContextPicker({
  editorRef,
  draft,
  onAddTicket,
  onAttach,
  onClose,
}: {
  editorRef: RefObject<LexicalEditor | null>
  draft: string
  onAddTicket: (ticket: Omit<ComposerTicketContext, 'id'>) => void
  onAttach: () => void
  onClose: () => void
}) {
  const reference = activeReference(draft)
  const query = reference?.trigger === '@' ? reference.query : ''
  return (
    <ContextPicker
      onAttach={() => {
        onClose()
        onAttach()
      }}
      onClose={onClose}
      query={query}
      onSelectTicket={(ticket) => {
        onClose()
        const editor = editorRef.current
        editor?.focus()
        editor?.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return
          const reference = $createComposerTicketReferenceNode(ticket.key, ticket.provider)
          selection.insertNodes([reference])
          const trailingSpace = $createTextNode(' ')
          reference.insertAfter(trailingSpace)
          trailingSpace.selectEnd()
        })
        onAddTicket(ticket)
      }}
    />
  )
}
