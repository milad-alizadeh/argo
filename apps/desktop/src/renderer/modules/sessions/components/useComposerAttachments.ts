import { useCallback } from 'react'

import { embedAttachments } from '../prompt/attachmentPrompt'
import { type ComposerAttachment, useComposerStore } from '../state/useComposerStore'

export function useComposerAttachments(sessionId: string) {
  const attachments = useComposerStore(({ attachments }) => attachments[sessionId] ?? [])
  const addAttachments = useComposerStore(({ addAttachments }) => addAttachments)
  const removeAttachment = useComposerStore(({ removeAttachment }) => removeAttachment)
  const markAttachmentsError = useComposerStore(({ markAttachmentsError }) => markAttachmentsError)
  const removeAttachments = useComposerStore(({ removeAttachments }) => removeAttachments)
  return {
    attachments,
    attach: useCallback(
      (paths: string[]) => addAttachments(sessionId, paths),
      [sessionId, addAttachments],
    ),
    remove: useCallback(
      (id: string) => removeAttachment(sessionId, id),
      [sessionId, removeAttachment],
    ),
    markError: useCallback(
      (ids: string[]) => markAttachmentsError(sessionId, ids),
      [sessionId, markAttachmentsError],
    ),
    clear: useCallback(
      (ids: string[]) => removeAttachments(sessionId, ids),
      [sessionId, removeAttachments],
    ),
  }
}

// The chooser and drag-and-drop are the two ways a file joins the strip (#1845 gap-decision);
// both just hand paths to the store.
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
// it was attached is caught here rather than reaching a Turn as a reference to nothing. A path
// that still reads becomes an inline `@path` reference (Claude Code's own file-mention syntax);
// one that does not stays in the strip, marked so the user can retry or remove it (AC5, #1845).
export async function resolveAttachments(
  draft: string,
  attachments: ComposerAttachment[],
  markError: (ids: string[]) => void,
): Promise<{ prompt: string; sentIds: string[] }> {
  if (attachments.length === 0) return { prompt: draft, sentIds: [] }
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
    prompt: embedAttachments(
      draft,
      sent.map((attachment) => attachment.path),
    ),
    sentIds: sent.map((attachment) => attachment.id),
  }
}
