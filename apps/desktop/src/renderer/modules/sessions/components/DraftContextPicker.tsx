import { $createTextNode, $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical'
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
          reference.selectEnd()
        })
      }}
    />
  )
}
