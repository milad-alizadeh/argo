import type { EditorConfig, NodeKey, SerializedTextNode } from 'lexical'
import { TextNode } from 'lexical'

import type { ComposerTicketContext } from '../state/useComposerStore'
import { ticketProviderIconSource } from './TicketProviderIcon'

function openTicket(ticketKey: string) {
  window.location.hash = `/tickets/${encodeURIComponent(ticketKey)}`
}

export class ComposerTicketReferenceNode extends TextNode {
  __provider: ComposerTicketContext['provider']

  constructor(text: string, provider: ComposerTicketContext['provider'], key?: NodeKey) {
    super(text, key)
    this.__provider = provider
  }

  static getType() {
    return 'composer-ticket-reference'
  }

  static clone(node: ComposerTicketReferenceNode) {
    return new ComposerTicketReferenceNode(node.__text, node.__provider, node.__key)
  }

  static importJSON(serializedNode: SerializedTextNode) {
    return $createComposerTicketReferenceNode(serializedNode.text, 'github')
      .setDetail(serializedNode.detail)
      .setFormat(serializedNode.format)
      .setMode(serializedNode.mode)
      .setStyle(serializedNode.style)
  }

  createDOM(config: EditorConfig) {
    const element = super.createDOM(config)
    const icon = element.ownerDocument.createElement('img')
    icon.alt = ''
    icon.className = 'mr-1 inline-block size-3.5 align-middle dark:invert'
    icon.contentEditable = 'false'
    icon.src = ticketProviderIconSource[this.__provider]
    element.className = 'mx-0.5 cursor-pointer font-semibold text-foreground'
    element.dataset.ticketKey = this.getTextContent()
    element.setAttribute('role', 'link')
    element.tabIndex = 0
    element.prepend(icon)
    element.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openTicket(this.getTextContent())
    })
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      openTicket(this.getTextContent())
    })
    return element
  }

  canInsertTextBefore() {
    return false
  }

  isTextEntity() {
    return true
  }
}

export function $createComposerTicketReferenceNode(
  text: string,
  provider: ComposerTicketContext['provider'],
) {
  return new ComposerTicketReferenceNode(text, provider)
}
