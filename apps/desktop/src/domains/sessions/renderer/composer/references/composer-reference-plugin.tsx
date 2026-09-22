import { useLexicalTextEntity } from '@lexical/react/useLexicalTextEntity'
import type { EntityMatch } from '@lexical/text'
import type { TextNode } from 'lexical'
import {
  $createComposerReferenceNode,
  ComposerReferenceNode,
} from '@/domains/sessions/renderer/composer/references/composer-reference-node'
import { referenceInText } from '@/domains/sessions/renderer/composer/references/session-reference'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'

function referenceMatch(text: string): EntityMatch | null {
  const match = referenceInText(text)
  if (match === null) return null
  return { end: match.end, start: match.start }
}

export function ComposerReferencePlugin({ harness = null }: { harness?: SessionHarness | null }) {
  useLexicalTextEntity(referenceMatch, ComposerReferenceNode, (textNode: TextNode) =>
    $createComposerReferenceNode(textNode.getTextContent(), harness),
  )
  return null
}
