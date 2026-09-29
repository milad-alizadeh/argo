import type { LiveSessionCommand } from '@/harnesses/registration'
import type { UserInput } from '../app-server/protocol-generated/v2/user-input'

type CodexInputItem = Extract<UserInput, { type: 'text' | 'localImage' }>
export const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000

export function inputItems(command: LiveSessionCommand): CodexInputItem[] {
  const items: CodexInputItem[] = [{ type: 'text', text: command.prompt, text_elements: [] }]
  for (const attachment of command.attachments) {
    if (attachment.kind === 'image') items.push({ type: 'localImage', path: attachment.path })
    else
      items.push({
        type: 'text',
        text: attachment.path,
        text_elements: [
          {
            byteRange: { start: 0, end: Buffer.byteLength(attachment.path) },
            placeholder: attachment.path,
          },
        ],
      })
  }
  return items
}
