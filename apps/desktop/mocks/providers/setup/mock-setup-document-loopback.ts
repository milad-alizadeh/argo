import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { setupConfiguration } from '../../../src/domains/projects/contract/setup-configuration'
import {
  parseSetupDocument,
  type SetupDocument,
} from '../../../src/domains/projects/contract/setup-document'

const documentPath = path.resolve(
  process.cwd(),
  '../../packages/argo-skills/setup/project-setup.json',
)
export const PACKAGED_PROOF_SETUP_DOCUMENT_REVISION = 'packaged-proof'

async function proofDocument(): Promise<SetupDocument> {
  const loaded = parseSetupDocument(JSON.parse(await readFile(documentPath, 'utf8')))
  const recommendations: Record<string, string> = {
    'target-path': '.',
    'setup-command': 'true',
    'run-command': 'true',
    'build-command': 'true',
    'test-command': 'true',
  }
  const fields = loaded.fields.map((field) =>
    field.type === 'text' && recommendations[field.id] !== undefined
      ? { ...field, recommendation: recommendations[field.id] }
      : field,
  )
  const configuration = structuredClone(loaded.configuration)
  const targets = configuration.targets
  const desktop = isRecord(targets) ? targets.desktop : undefined
  if (!isRecord(desktop)) throw new Error('Packaged proof requires the desktop target.')
  desktop.build = 'true'
  const document = {
    ...loaded,
    configuration,
    revision: PACKAGED_PROOF_SETUP_DOCUMENT_REVISION,
    fields,
  }
  return {
    ...document,
    configuration: JSON.parse(setupConfiguration(document, {})),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function startMockSetupDocumentLoopback() {
  const document = await proofDocument()
  let requestCount = 0
  const server = createServer((_request, response) => {
    requestCount += 1
    setTimeout(() => {
      if (requestCount === 1) {
        response.writeHead(503)
        response.end()
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(document))
    }, 500)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/project-setup.json`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

export type MockSetupDocument = Awaited<ReturnType<typeof startMockSetupDocumentLoopback>>
