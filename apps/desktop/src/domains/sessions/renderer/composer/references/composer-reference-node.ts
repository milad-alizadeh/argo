import type { EditorConfig, NodeKey, SerializedTextNode } from 'lexical'
import { TextNode } from 'lexical'
import type { SessionHarness } from '../../harness/harnesses'
import { composerReferenceIcon } from './composer-reference-icon'
import { harnessLabel, referenceBySource, referenceSupportsHarness } from './session-reference'

const SUPPORTED_CLASS =
  'composer-inline-context mx-0.5 inline-flex items-center gap-1 align-middle cursor-text !font-semibold text-foreground type-body'
const UNSUPPORTED_CLASS =
  'composer-inline-context mx-0.5 inline-flex items-center gap-1 align-middle cursor-text text-muted-foreground type-body'

export class ComposerReferenceNode extends TextNode {
  __harness: SessionHarness | null

  constructor(text: string, harness: SessionHarness | null = null, key?: NodeKey) {
    super(text, key)
    this.__harness = harness
  }

  static getType() {
    return 'composer-reference'
  }

  static clone(node: ComposerReferenceNode) {
    return new ComposerReferenceNode(node.__text, node.__harness, node.__key)
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
    const unsupported =
      reference !== undefined && !referenceSupportsHarness(reference, this.__harness)
    element.className = unsupported ? UNSUPPORTED_CLASS : SUPPORTED_CLASS
    element.dataset.reference = text
    element.dataset.contextLabel = reference?.label ?? text
    if (reference) element.prepend(composerReferenceIcon(element.ownerDocument, reference.kind))
    if (unsupported) {
      element.dataset.unsupported = 'true'
      const fact = element.ownerDocument.createElement('span')
      fact.className = 'sr-only'
      fact.textContent = ` — not available for ${harnessLabel(this.__harness)}`
      element.appendChild(fact)
    }
    return element
  }

  isTextEntity() {
    return true
  }
}

export function $createComposerReferenceNode(text: string, harness: SessionHarness | null = null) {
  return new ComposerReferenceNode(text, harness)
}
