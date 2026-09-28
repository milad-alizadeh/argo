import type { EditorConfig, NodeKey, SerializedTextNode } from 'lexical'
import { $createTextNode, TextNode } from 'lexical'
import { provider as providerSchema } from '@/domains/accounts/contract/contract'
import { PROVIDER_PRESENTATIONS } from '@/providers/presentation-registry'
import type { ComposerTicketContext } from '../editing/composer-editing'

type SerializedTicketReferenceNode = SerializedTextNode & { provider?: unknown }

function openTicket(ticketKey: string) {
  const projectId = window.location.hash.match(/^#\/projects\/([^/]+)/)?.[1]
  if (projectId) {
    window.location.hash = `/projects/${projectId}/tickets/${encodeURIComponent(ticketKey)}`
  }
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

  // A reference whose provider is not recognized pastes back as its plain key.
  static importJSON(serializedNode: SerializedTicketReferenceNode) {
    const provider = providerSchema.safeParse(serializedNode.provider)
    const node = provider.success
      ? $createComposerTicketReferenceNode(serializedNode.text, provider.data)
      : $createTextNode(serializedNode.text)
    return node
      .setDetail(serializedNode.detail)
      .setFormat(serializedNode.format)
      .setMode(serializedNode.mode)
      .setStyle(serializedNode.style)
  }

  exportJSON(): SerializedTicketReferenceNode {
    return { ...super.exportJSON(), provider: this.__provider }
  }

  createDOM(config: EditorConfig) {
    const element = super.createDOM(config)
    const icon = element.ownerDocument.createElement('img')
    icon.alt = ''
    icon.className = 'size-3.5 shrink-0 dark:invert'
    icon.contentEditable = 'false'
    icon.src = PROVIDER_PRESENTATIONS[this.__provider].icon
    element.className =
      'mx-0.5 inline-flex items-center gap-1 align-middle !font-semibold text-foreground type-body'
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
