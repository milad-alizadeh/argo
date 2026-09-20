// Choosing and statting composer attachments. Neither writes anything: choosing hands back the
// paths a native dialog returned, and statting reports which of those paths are still readable so
// a file removed after it was attached is caught before it reaches a Turn.
import { access, constants } from 'node:fs/promises'
import type {
  SessionAttachmentsChosen,
  SessionAttachmentsStatted,
  SessionChooseAttachmentsRequest,
  SessionStatAttachmentsRequest,
} from '@/domains/sessions/contract/ipc/contract'

export type AttachmentsStore = { chooseFiles: () => Promise<string[]> }

export async function chooseAttachments(
  request: SessionChooseAttachmentsRequest,
  store: AttachmentsStore,
): Promise<SessionAttachmentsChosen> {
  const paths = await store.chooseFiles()
  return {
    version: 1,
    type: 'session.attachments.chosen',
    requestId: request.requestId,
    paths,
  }
}

async function isReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

export async function statAttachments(
  request: SessionStatAttachmentsRequest,
): Promise<SessionAttachmentsStatted> {
  const files = await Promise.all(
    request.paths.map(async (path) => ({ path, readable: await isReadable(path) })),
  )
  return {
    version: 1,
    type: 'session.attachments.statted',
    requestId: request.requestId,
    files,
  }
}
