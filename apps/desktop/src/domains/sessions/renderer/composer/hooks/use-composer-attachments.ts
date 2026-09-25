import { useCallback } from 'react'

import { attachmentKindOf, type SessionAttachmentInput } from '@/domains/sessions/api/attachments'
import type { ComposerAttachment } from '../editing/composer-editing'
import { useComposerEditing } from '../editing/composer-editing-context'

export function useComposerAttachments() {
  const { editing, dispatch } = useComposerEditing()
  return {
    attachments: editing.attachments,
    markError: useCallback(
      (ids: string[]) => dispatch({ type: 'attachments.failed', ids }),
      [dispatch],
    ),
    clear: useCallback(
      (ids: string[]) => dispatch({ type: 'attachments.removed', ids }),
      [dispatch],
    ),
  }
}

// The chooser and drag-and-drop are the two ways a file joins the strip (#1845 gap-decision);
// both hand paths to the active composer edit.
export function useAttachmentTransfer(attach: (paths: string[]) => void) {
  return {
    attachFiles: useCallback(async () => {
      const reply = await window.argo.chooseSessionAttachments()
      if (reply.type === 'session.attachments.chosen') attach(reply.paths)
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
  const reply = await window.argo.statSessionAttachments({
    paths: attachments.map((attachment) => attachment.path),
  })
  const readable =
    reply.type === 'session.attachments.statted'
      ? new Set(reply.files.filter((file) => file.readable).map((file) => file.path))
      : new Set<string>()
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
