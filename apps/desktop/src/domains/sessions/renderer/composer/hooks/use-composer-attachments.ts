import { useCallback } from 'react'

import { attachmentKindOf, type SessionAttachmentInput } from '@/domains/sessions/api/attachments'
import { trpcClient } from '@/platform/renderer/trpc-client'
import type { ComposerAttachment } from '../editing/composer-editing'

// The chooser and drag-and-drop are the two ways a file joins the strip (#1845 gap-decision);
// both hand paths to the active composer edit.
export function useAttachmentTransfer(attach: (paths: string[]) => void) {
  return {
    attachFiles: useCallback(async () => {
      const reply = await trpcClient.sessionAttachmentChoose.mutate()
      attach(reply.paths)
    }, [attach]),
    dropFiles: useCallback(
      (files: FileList) => {
        attach(Array.from(files).map((file) => window.argo.pathForFile(file)))
      },
      [attach],
    ),
  }
}

// Every attached path is checked again right before it leaves the composer: a file removed since
// it was attached is caught here rather than reaching a Turn as a reference to nothing (an
// "unsupported" attachment, AC4). What a readable path becomes on the wire is each Harness's own
// adapter's call (agents/<harness>/), so this hands back the draft text and the attachments untouched
// rather than folding them into the prompt itself (#1886).
export async function resolveAttachments(
  draft: string,
  attachments: ComposerAttachment[],
  markError: (ids: string[]) => void,
): Promise<{ prompt: string; attachments: SessionAttachmentInput[]; sentIds: string[] }> {
  if (attachments.length === 0) return { prompt: draft, attachments: [], sentIds: [] }
  const reply = await trpcClient.sessionAttachmentStat.query({
    paths: attachments.map((attachment) => attachment.path),
  })
  const readable = new Set(reply.files.filter((file) => file.readable).map((file) => file.path))
  const sent = attachments.filter((attachment) => readable.has(attachment.path))
  const failed = attachments.filter((attachment) => !readable.has(attachment.path))
  if (failed.length > 0) markError(failed.map((attachment) => attachment.id))
  return {
    prompt: draft,
    attachments: sent.map((attachment) => ({
      path: attachment.path,
      kind: attachmentKindOf(attachment.path),
    })),
    sentIds: sent.map((attachment) => attachment.id),
  }
}
