import type { EditorConfig, NodeKey, SerializedTextNode } from 'lexical'
import { TextNode } from 'lexical'
import { composerReferenceIcon } from '@/domains/sessions/renderer/composer/references/composer-reference-icon'
import {
  cliLabel,
  referenceBySource,
  referenceSupportsCli,
} from '@/domains/sessions/renderer/composer/references/session-reference'
import type { SessionCli } from '@/domains/sessions/renderer/harness/harnesses'

const SUPPORTED_CLASS =
  'composer-inline-context mx-0.5 inline-flex items-center gap-1 align-middle cursor-text !font-semibold text-foreground type-body'
const UNSUPPORTED_CLASS =
  'composer-inline-context mx-0.5 inline-flex items-center gap-1 align-middle cursor-text text-muted-foreground type-body'

export class ComposerReferenceNode extends TextNode {
  __cli: SessionCli | null

  constructor(text: string, cli: SessionCli | null = null, key?: NodeKey) {
    super(text, key)
    this.__cli = cli
  }

  static getType() {
    return 'composer-reference'
  }

  static clone(node: ComposerReferenceNode) {
    return new ComposerReferenceNode(node.__text, node.__cli, node.__key)
  }

  static importJSON(serializedNode: SerializedTextNode) {
    return $createComposerReferenceNode(serializedNode.text)
      .setDetail(serializedNode.detail)
      .setFormat(serializedNode.format)
      .setMode(serializedNode.mode)
      .setStyle(serializedNode.style)
  }

  createDOM(config: EditorConfig) {
    const element = super.createDOM(config)
    const text = this.getTextContent()
    const reference = referenceBySource(text)
    const unsupported = reference !== undefined && !referenceSupportsCli(reference, this.__cli)
    element.className = unsupported ? UNSUPPORTED_CLASS : SUPPORTED_CLASS
    element.dataset.reference = text
    element.dataset.contextLabel = reference?.label ?? text
    if (reference) element.prepend(composerReferenceIcon(element.ownerDocument, reference.kind))
    if (unsupported) {
      element.dataset.unsupported = 'true'
      const fact = element.ownerDocument.createElement('span')
      fact.className = 'sr-only'
      fact.textContent = ` — not available for ${cliLabel(this.__cli)}`
      element.appendChild(fact)
    }
    return element
  }

  isTextEntity() {
    return true
  }
}

export function $createComposerReferenceNode(text: string, cli: SessionCli | null = null) {
  return new ComposerReferenceNode(text, cli)
}
