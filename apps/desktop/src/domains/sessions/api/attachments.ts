// Choosing a path and proving it is still readable at Send time is the same work for every Harness;
// only each Harness's own adapter (agents/<harness>/) turns a readable path into that Harness's wire
// representation of an attachment (#1886).
import { z } from 'zod'

// The formats every adapter's own image input variant accepts;
// anything else is a generic file reference. Kept as one classifier so the composer's preview
// (image thumbnail vs. file icon) and the wire representation never disagree (#1845, #1886).
const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|webp)$/i

export function attachmentKindOf(path: string): 'image' | 'file' {
  return IMAGE_EXTENSION.test(path) ? 'image' : 'file'
}

export const sessionAttachmentInputSchema = z.strictObject({
  path: z.string(),
  kind: z.enum(['image', 'file']),
})
export type SessionAttachmentInput = z.infer<typeof sessionAttachmentInputSchema>
