import { $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical'
import type { RefObject } from 'react'

import type { ComposerTicketContext } from '../state/useComposerStore'
import { $createComposerTicketReferenceNode } from './ComposerTicketReferenceNode'
import { ContextPicker } from './ContextPicker'

export function DraftContextPicker({
  editorRef,
  onAddTicket,
  onAttach,
  onClose,
}: {
  editorRef: RefObject<LexicalEditor | null>
  onAddTicket: (ticket: Omit<ComposerTicketContext, 'id'>) => void
  onAttach: () => void
  onClose: () => void
}) {
  return (
    <ContextPicker
      onAttach={() => {
        onClose()
        onAttach()
      }}
      onClose={onClose}
      onSelectTicket={(ticket) => {
        onAddTicket(ticket)
        editorRef.current?.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return
          selection.insertText(' ')
          const reference = $createComposerTicketReferenceNode(ticket.key, ticket.provider)
          selection.insertNodes([reference])
          reference.selectNext()
        })
        onClose()
      }}
    />
  )
}
