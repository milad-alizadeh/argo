import { useCallback } from 'react'

import {
  attachmentKindOf,
  type SessionAttachmentInput,
} from '@/domains/sessions/contract/drive/attachments-contract'
import {
  type ComposerAttachment,
  EMPTY_COMPOSER_ATTACHMENTS,
  useComposerStore,
} from './use-composer-store'

// A stable reference for "no attachments yet": the selector below must return the same array on
// every call with no entry, or zustand's useSyncExternalStore snapshot never settles (#1845).
export function useComposerAttachments(sessionId: string) {
  const attachments = useComposerStore(
    ({ attachments }) => attachments[sessionId] ?? EMPTY_COMPOSER_ATTACHMENTS,
  )
  const markAttachmentsError = useComposerStore(({ markAttachmentsError }) => markAttachmentsError)
  const removeAttachments = useComposerStore(({ removeAttachments }) => removeAttachments)
  return {
    attachments,
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
