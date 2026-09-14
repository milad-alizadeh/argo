import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { SESSION_CLIS, type SessionCli } from '../harness/harnesses'

// A path the user attached. `error` means the file was unreadable the last time it was checked
// (typically at Send), so it stays in the strip for the user to fix or remove rather than being
// sent silently.
export type ComposerAttachment = {
  id: string
  path: string
  status: 'idle' | 'error'
}

const attachmentSchema = z.object({
  id: z.string(),
  path: z.string(),
  status: z.enum(['idle', 'error']),
})

// What a composer keeps across leaving the page and relaunching: each composer's unsent draft and
// attachments, and the harness the last new Session was set to, app-wide.
type ComposerState = {
  harness: SessionCli
  drafts: Record<string, string>
  attachments: Record<string, ComposerAttachment[]>
  chooseHarness: (harness: SessionCli) => void
  setDraft: (composerKey: string, text: string) => void
  addAttachments: (composerKey: string, paths: string[]) => void
  removeAttachment: (composerKey: string, id: string) => void
  markAttachmentsError: (composerKey: string, ids: string[]) => void
  removeAttachments: (composerKey: string, ids: string[]) => void
}

const storedSchema = z
  .object({
    harness: z.enum(SESSION_CLIS),
    drafts: z.record(z.string(), z.string()),
    attachments: z.record(z.string(), z.array(attachmentSchema)),
  })
  .partial()

function updateAttachments(
  attachments: Record<string, ComposerAttachment[]>,
  composerKey: string,
  update: (current: ComposerAttachment[]) => ComposerAttachment[],
): Record<string, ComposerAttachment[]> {
  const updated = update(attachments[composerKey] ?? [])
  if (updated.length === 0) {
    const { [composerKey]: _replaced, ...others } = attachments
    return others
  }
  return { ...attachments, [composerKey]: updated }
}

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      harness: 'claude',
      drafts: {},
      attachments: {},
      chooseHarness: (harness) => set({ harness }),
      setDraft: (composerKey, text) =>
        set(({ drafts }) => {
          const { [composerKey]: _replaced, ...others } = drafts
          return { drafts: text === '' ? others : { ...others, [composerKey]: text } }
        }),
      addAttachments: (composerKey, paths) =>
        set(({ attachments }) => ({
          attachments: updateAttachments(attachments, composerKey, (current) => {
            const known = new Set(current.map((attachment) => attachment.path))
            const reattached = new Set(paths.filter((path) => known.has(path)))
            const added = paths
              .filter((path) => !known.has(path))
              .map((path) => ({ id: crypto.randomUUID(), path, status: 'idle' as const }))
            // Re-attaching a path already in the strip is how the user retries a failed one
            // (#1845): it clears the error rather than being dropped as a no-op duplicate.
            const retried = current.map((attachment) =>
              reattached.has(attachment.path)
                ? { ...attachment, status: 'idle' as const }
                : attachment,
            )
            return [...retried, ...added]
          }),
        })),
      removeAttachment: (composerKey, id) =>
        set(({ attachments }) => ({
          attachments: updateAttachments(attachments, composerKey, (current) =>
            current.filter((attachment) => attachment.id !== id),
          ),
        })),
      markAttachmentsError: (composerKey, ids) =>
        set(({ attachments }) => ({
          attachments: updateAttachments(attachments, composerKey, (current) =>
            current.map((attachment) =>
              ids.includes(attachment.id) ? { ...attachment, status: 'error' } : attachment,
            ),
          ),
        })),
      removeAttachments: (composerKey, ids) =>
        set(({ attachments }) => ({
          attachments: updateAttachments(attachments, composerKey, (current) =>
            current.filter((attachment) => !ids.includes(attachment.id)),
          ),
        })),
    }),
    {
      name: 'argo.composer',
      partialize: ({ harness, drafts, attachments }) => ({ harness, drafts, attachments }),
      merge: (stored, current) => ({ ...current, ...storedSchema.safeParse(stored).data }),
    },
  ),
)
