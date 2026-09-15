import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  type LexicalEditor,
} from 'lexical'
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
  const reference = activeReference(draft.trimEnd())
  const query = reference?.trigger === '@' ? reference.query : ''
  return (
    <ContextPicker
      onAttach={() => {
        onClose()
        onAttach()
      }}
      onClose={onClose}
      query={query}
      autoFocus={reference === null}
      onSelectTicket={(ticket) => {
        onClose()
        const editor = editorRef.current
        editor?.focus()
        editor?.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return
          const textNode = selection.anchor.getNode()
          if ($isTextNode(textNode)) {
            const cursor = selection.anchor.offset
            const active = activeReference(textNode.getTextContent().slice(0, cursor))
            if (active?.trigger === '@') {
              const before = `${textNode.getTextContent().slice(0, cursor - active.source.length)}${active.leading}`
              textNode.setTextContent(`${before}${textNode.getTextContent().slice(cursor)}`)
              textNode.select(before.length, before.length)
            }
          }
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
