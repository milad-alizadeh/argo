// A `$skill` mention typed or pasted into the composer decorates as the same badge the Feed and
// the Roster draw (#2049, PromptText.tsx). Its text content round-trips to the CLI's own
// `[$name](path)` markdown-link syntax, so what the composer sends is unchanged.
import type { EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode } from 'lexical'
import { DecoratorNode } from 'lexical'
import type { ReactNode } from 'react'
import { SkillBadge } from '../prompt/PromptText'

export type SerializedSkillMentionNode = SerializedLexicalNode & {
  skillName: string
  skillPath: string
}

export class SkillMentionNode extends DecoratorNode<ReactNode> {
  __name: string
  __path: string

  static getType(): string {
    return 'skill-mention'
  }

  static clone(node: SkillMentionNode): SkillMentionNode {
    return new SkillMentionNode(node.__name, node.__path, node.__key)
  }

  static importJSON(serialized: SerializedSkillMentionNode): SkillMentionNode {
    return $createSkillMentionNode(serialized.skillName, serialized.skillPath)
  }

  constructor(name: string, path: string, key?: NodeKey) {
    super(key)
    this.__name = name
    this.__path = path
  }

  exportJSON(): SerializedSkillMentionNode {
    return {
      ...super.exportJSON(),
      type: 'skill-mention',
      version: 1,
      skillName: this.__name,
      skillPath: this.__path,
    }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span')
    span.style.display = 'inline-block'
    return span
  }

  updateDOM(): boolean {
    return false
  }

  isInline(): boolean {
    return true
  }

  // The draft the composer sends, and what a markdown export round-trips, is the mention's own
  // link syntax, not the badge's display label.
  getTextContent(): string {
    return `[$${this.__name}](${this.__path})`
  }

  decorate(): ReactNode {
    return <SkillBadge name={this.__name} />
  }
}

export function $createSkillMentionNode(name: string, path: string): SkillMentionNode {
  return new SkillMentionNode(name, path)
}

export function $isSkillMentionNode(
  node: LexicalNode | null | undefined,
): node is SkillMentionNode {
  return node instanceof SkillMentionNode
}
