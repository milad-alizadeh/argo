import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
} from 'lexical'
import type { RefObject } from 'react'
import { useEffect, useState } from 'react'

import type { ComposerTicketContext } from '../../state/use-composer-store'
import { activeReference } from '../composer/references/composer-reference-menu'
import { $createComposerTicketReferenceNode } from '../composer/references/composer-ticket-reference-node'
import { ContextPicker } from './context-picker'

function contextTicketButtons() {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-context-ticket="true"]')]
}

function moveTicketSelection(
  event: KeyboardEvent,
  length: number,
  setSelectedIndex: (value: (index: number) => number) => void,
) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false
  event.preventDefault()
  setSelectedIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + length) % length)
  return true
}

function useTicketKeyboardNavigation(editorRef: RefObject<LexicalEditor | null>, active: boolean) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  useEffect(() => {
    const editor = editorRef.current
    if (editor === null) return
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!active) return false
        const tickets = contextTicketButtons()
        if (tickets.length === 0) return false
        if (moveTicketSelection(event, tickets.length, setSelectedIndex)) return true
        if (event.key !== 'Enter') return false
        const ticket = tickets[selectedIndex]
        if (ticket === undefined) return false
        event.preventDefault()
        ticket.click()
        return true
      },
      COMMAND_PRIORITY_HIGH,
    )
  }, [active, editorRef, selectedIndex])
  return selectedIndex
}

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
  const selectedIndex = useTicketKeyboardNavigation(editorRef, reference?.trigger === '@')
  return (
    <ContextPicker
      onAttach={() => {
        onClose()
        onAttach()
      }}
      onClose={onClose}
      query={query}
      autoFocus={reference === null}
      selectedIndex={selectedIndex}
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
