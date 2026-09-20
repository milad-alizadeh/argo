import { useCallback } from 'react'

import {
  attachmentKindOf,
  type SessionAttachmentInput,
} from '@/domains/sessions/contract/attachments-contract'
import {
  type ComposerAttachment,
  type ComposerTicketContext,
  useComposerStore,
} from '@/domains/sessions/renderer/composer/use-composer-store'

// A stable reference for "no attachments yet": the selector below must return the same array on
// every call with no entry, or zustand's useSyncExternalStore snapshot never settles (#1845).
const NO_ATTACHMENTS: ComposerAttachment[] = []
const NO_TICKETS: ComposerTicketContext[] = []

export function useComposerAttachments(sessionId: string) {
  const attachments = useComposerStore(
    ({ attachments }) => attachments[sessionId] ?? NO_ATTACHMENTS,
  )
  const tickets = useComposerStore(({ tickets }) => tickets[sessionId] ?? NO_TICKETS)
  const addAttachments = useComposerStore(({ addAttachments }) => addAttachments)
  const removeAttachment = useComposerStore(({ removeAttachment }) => removeAttachment)
  const markAttachmentsError = useComposerStore(({ markAttachmentsError }) => markAttachmentsError)
  const removeAttachments = useComposerStore(({ removeAttachments }) => removeAttachments)
  const addTicket = useComposerStore(({ addTicket }) => addTicket)
  const removeTicket = useComposerStore(({ removeTicket }) => removeTicket)
  return {
    attachments,
    tickets,
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
    addTicket: useCallback(
      (ticket: Omit<ComposerTicketContext, 'id'>) => addTicket(sessionId, ticket),
      [sessionId, addTicket],
    ),
    removeTicket: useCallback(
      (id: string) => removeTicket(sessionId, id),
      [sessionId, removeTicket],
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
// "unsupported" attachment, AC4). What a readable path becomes on the wire is each CLI's own
// adapter's call (agents/<cli>/), so this hands back the draft text and the attachments untouched
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
