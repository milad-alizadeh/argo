import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

const DOCUMENT = {
  version: 1,
  revision: 'packaged-proof',
  requiredCapabilities: ['fields', 'recommendations', 'plan', 'locales'],
  locales: {
    en: {
      title: 'Remote setup proof',
      description: 'This plan came from the mock GitHub document.',
      fields: { 'target-path': { label: 'Remote working path' } },
      plan: { review: { label: 'Review the remote plan' } },
    },
  },
  fields: [
    {
      id: 'target-path',
      type: 'text',
      required: true,
      recommendation: '.',
      configurationPath: ['targets', 'app', 'path'],
    },
  ],
  configuration: {
    version: 1,
    targets: { app: { default: true, path: '.', setup: '', run: '', build: '', test: '' } },
  },
  plan: [{ id: 'review' }],
}

export async function startMockSetupDocumentLoopback() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(DOCUMENT))
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
