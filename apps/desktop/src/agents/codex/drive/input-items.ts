import type { SessionAttachmentInput } from '../../../core/sessions/attachments-contract'

export type TextInput = { type: 'text'; text: string; text_elements: [] }
export type Input = TextInput | { type: 'localImage'; path: string }

// The draft is the first input item, always a `text` item. An attachment is a second, separate
// item, never folded into the draft text (docs/research/2026-09-09-codex-transport.md): an image
// becomes one `localImage` item, in attachment order; every other file becomes its own `text` item
// holding its absolute path, a file reference Codex reads through its own tools, not an upload.
// The protocol declares no generic `file` input variant.
export function inputItemsFor(prompt: string, attachments: SessionAttachmentInput[]): Input[] {
  const attachmentItems: Input[] = attachments.map((attachment) =>
    attachment.kind === 'image'
      ? { type: 'localImage', path: attachment.path }
      : { type: 'text', text: attachment.path, text_elements: [] },
  )
  return [{ type: 'text', text: prompt, text_elements: [] }, ...attachmentItems]
}
