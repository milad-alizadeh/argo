import { useLexicalTextEntity } from '@lexical/react/useLexicalTextEntity'
import type { EntityMatch } from '@lexical/text'
import type { TextNode } from 'lexical'
import { $createComposerReferenceNode, ComposerReferenceNode } from './ComposerReferenceNode'
import { referenceInText } from './SessionReference'

function referenceMatch(text: string): EntityMatch | null {
  const match = referenceInText(text)
  if (match === null) return null
  return { end: match.end, start: match.start }
}

function createReferenceNode(textNode: TextNode) {
  return $createComposerReferenceNode(textNode.getTextContent())
}

export function ComposerReferencePlugin() {
  useLexicalTextEntity(referenceMatch, ComposerReferenceNode, createReferenceNode)
  return null
}
