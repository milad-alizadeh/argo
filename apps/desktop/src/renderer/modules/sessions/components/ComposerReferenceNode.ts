import type { EditorConfig, SerializedTextNode } from 'lexical'
import { TextNode } from 'lexical'

export class ComposerReferenceNode extends TextNode {
  static getType() {
    return 'composer-reference'
  }

  static clone(node: ComposerReferenceNode) {
    return new ComposerReferenceNode(node.__text, node.__key)
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
    element.className =
      'mx-0.5 inline-flex rounded-4xl border border-border bg-secondary px-2 py-0.5 font-mono text-meta text-foreground'
    element.dataset.reference = this.getTextContent()
    return element
  }

  isTextEntity() {
    return true
  }
}

export function $createComposerReferenceNode(text: string) {
  return new ComposerReferenceNode(text)
}
