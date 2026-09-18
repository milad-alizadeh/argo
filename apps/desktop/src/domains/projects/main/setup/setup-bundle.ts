import { parseSetupDocument, type SetupDocument } from '../../contract/setup-document'
import { SETUP_DOCUMENT_PROOF_URL_ENV } from '../proof-protocol'

export const ARGO_SETUP_DOCUMENT_URL =
  'https://raw.githubusercontent.com/milad-alizadeh/argo/main/packages/argo-skills/setup/project-setup.json'

export function setupDocumentURL(proofEnabled: boolean): string {
  const proofURL = process.env[SETUP_DOCUMENT_PROOF_URL_ENV]
  if (!proofEnabled || proofURL === undefined) return ARGO_SETUP_DOCUMENT_URL
  const parsed = new URL(proofURL)
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') {
    throw new Error(`${SETUP_DOCUMENT_PROOF_URL_ENV} is not a loopback URL`)
  }
  return parsed.href
}

type SetupDocumentRequest = {
  documentURL: string
  request: (url: string) => Promise<Response | null>
}

export class SetupDocumentLoadError extends Error {
  constructor(readonly reason: 'network-unavailable' | 'document-invalid') {
    super(reason)
  }
}

export async function loadSetupDocument({
  documentURL,
  request,
}: SetupDocumentRequest): Promise<SetupDocument> {
  const response = await request(documentURL)
  if (!response?.ok) throw new SetupDocumentLoadError('network-unavailable')
  try {
    return parseSetupDocument(await response.json())
  } catch {
    throw new SetupDocumentLoadError('document-invalid')
  }
}
