import { SETUP_DOCUMENT_PROOF_URL_ENV } from '@/domains/projects/main/proof-protocol'
import { parseSetupDocument, type SetupDocument } from '../../contract/setup-document'
import {
  ARGO_SETUP_DOCUMENT_URL,
  DEVELOPMENT_SETUP_DOCUMENT_URL_ENV,
  parseArgoSetupDocumentURL,
} from './setup-document-source.mjs'

export { ARGO_SETUP_DOCUMENT_URL }

export type SetupDocumentSource = 'development' | 'production' | 'proof'

function proofSetupDocumentURL(): string {
  const proofURL = process.env[SETUP_DOCUMENT_PROOF_URL_ENV]
  if (proofURL === undefined) return ARGO_SETUP_DOCUMENT_URL
  const parsed = new URL(proofURL)
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') {
    throw new Error(`${SETUP_DOCUMENT_PROOF_URL_ENV} is not a loopback URL`)
  }
  return parsed.href
}

function developmentSetupDocumentURL(): string {
  const developmentURL = process.env[DEVELOPMENT_SETUP_DOCUMENT_URL_ENV]
  if (developmentURL === undefined) return ARGO_SETUP_DOCUMENT_URL
  const parsed = parseArgoSetupDocumentURL(developmentURL)
  if (parsed === null) {
    throw new Error(`${DEVELOPMENT_SETUP_DOCUMENT_URL_ENV} is not an Argo GitHub document URL`)
  }
  return parsed
}

const setupDocumentSources = {
  development: developmentSetupDocumentURL,
  production: () => ARGO_SETUP_DOCUMENT_URL,
  proof: proofSetupDocumentURL,
} satisfies Record<SetupDocumentSource, () => string>

export function setupDocumentURL(source: SetupDocumentSource = 'production'): string {
  return setupDocumentSources[source]()
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
