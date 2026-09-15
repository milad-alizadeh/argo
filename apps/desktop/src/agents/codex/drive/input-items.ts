import type { SessionAttachmentInput } from '../../../core/sessions/attachments-contract'

// app-server v2 `TextElement` (v2/turn.rs, rust-v0.147.0): a UTF-8 byte range and its placeholder.
type TextElement = { byteRange: { start: number; end: number }; placeholder: string }
export type TextInput = { type: 'text'; text: string; text_elements: TextElement[] }
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
      : pathItem(attachment.path),
  )
  return [{ type: 'text', text: prompt, text_elements: [] }, ...attachmentItems]
}

// The rollout joins every text item into one message, so the path is marked to be found again.
function pathItem(path: string): TextInput {
  const byteRange = { start: 0, end: Buffer.byteLength(path) }
  return { type: 'text', text: path, text_elements: [{ byteRange, placeholder: path }] }
}
