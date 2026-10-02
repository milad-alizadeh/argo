import { $createParagraphNode, $getRoot, $isElementNode, createEditor } from 'lexical'
import { expect, test } from 'vitest'
import { ComposerTicketReferenceNode } from './composer-ticket-reference-node'

test('an unknown serialized Ticket provider restores as plain key text', () => {
  const editor = createEditor({ nodes: [ComposerTicketReferenceNode] })

  editor.update(
    () => {
      const node = ComposerTicketReferenceNode.importJSON({
        type: 'text',
        version: 1,
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: 'ENG-42',
        provider: 'unknown-provider',
      })
      const paragraph = $createParagraphNode()
      paragraph.append(node)
      $getRoot().append(paragraph)
    },
    { discrete: true },
  )

  editor.getEditorState().read(() => {
    const paragraph = $getRoot().getFirstChild()
    const node = $isElementNode(paragraph) ? paragraph.getFirstChild() : null
    expect(node?.getType()).toBe('text')
    expect(node?.getTextContent()).toBe('ENG-42')
  })
})
