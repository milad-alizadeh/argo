import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalTextEntity } from '@lexical/react/useLexicalTextEntity'
import type { EntityMatch } from '@lexical/text'
import {
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_CRITICAL,
  KEY_BACKSPACE_COMMAND,
  type LexicalNode,
  type TextNode,
} from 'lexical'
import { useEffect } from 'react'

import type { ComposerTicketContext } from '../state/use-composer-store'
import {
  $createComposerTicketReferenceNode,
  ComposerTicketReferenceNode,
} from './composer-ticket-reference-node'

function ticketMatch(text: string, tickets: ComposerTicketContext[]): EntityMatch | null {
  for (const ticket of tickets) {
    const start = text.indexOf(ticket.key)
    const end = start + ticket.key.length
    if (start < 0) continue
    if (start > 0 && !/\s/.test(text[start - 1] ?? '')) continue
    if (end < text.length && !/[\s.,:;!?)]/.test(text[end] ?? '')) continue
    return { end, start }
  }
  return null
}

function ticketBeforeCursor(node: LexicalNode, offset: number) {
  if (node instanceof ComposerTicketReferenceNode && offset === node.getTextContentSize()) {
    return node
  }
  if ($isTextNode(node)) {
    if (offset !== 0) return null
    const previous = node.getPreviousSibling()
    return previous instanceof ComposerTicketReferenceNode ? previous : null
  }
  if (!$isElementNode(node) || offset === 0) return null
  const previous = node.getChildAtIndex(offset - 1)
  if (previous instanceof ComposerTicketReferenceNode) return previous
  const last = $isElementNode(previous) ? previous.getLastDescendant() : null
  return last instanceof ComposerTicketReferenceNode ? last : null
}

export function ComposerTicketReferencePlugin({ tickets }: { tickets: ComposerTicketContext[] }) {
  const [editor] = useLexicalComposerContext()
  useLexicalTextEntity(
    (text) => ticketMatch(text, tickets),
    ComposerTicketReferenceNode,
    (textNode: TextNode) => {
      const ticket = tickets.find(({ key }) => key === textNode.getTextContent())
      return ticket ? $createComposerTicketReferenceNode(ticket.key, ticket.provider) : textNode
    },
  )
  useEffect(
    () =>
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          const selection = $getSelection()
          if ($isNodeSelection(selection)) {
            const ticket = selection
              .getNodes()
              .find((node) => node instanceof ComposerTicketReferenceNode)
            if (ticket !== undefined) {
              ticket.remove()
              return true
            }
          }
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
          const node = selection.anchor.getNode()
          const ticket = ticketBeforeCursor(node, selection.anchor.offset)
          if (ticket === null) return false
          ticket.remove()
          return true
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    [editor],
  )
  return null
}
