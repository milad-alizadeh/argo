import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { statusHookEventSchema } from '@/harnesses/host/status-hooks'
import type { ExternalSessions } from '@/harnesses/registration'
import type { ExternalSessionPoll } from './external-session-poll'

// A hook payload is one JSON object; anything larger is not one Argo installed.
const BODY_LIMIT_BYTES = 1024 * 1024
const HOOK_PATH = /^\/h\/([^/]+)\/([^/]+)$/

type ExternalSessionHooksContext = {
  poll: ExternalSessionPoll
  harnesses: readonly { harness: Harness; external: ExternalSessions }[]
}

async function readBody(request: IncomingMessage): Promise<string | null> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > BODY_LIMIT_BYTES) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function parseJson(text: string | null): unknown {
  if (text === null) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// Installs every Harness's status hooks once, globally, naming one loopback port, and passes
// what they post to the poll. A failed install leaves that Harness on the poll.
export class ExternalSessionHooks {
  readonly #context: ExternalSessionHooksContext
  readonly #server: Server
  #rejected = 0
  #installFailures = 0

  constructor(context: ExternalSessionHooksContext) {
    this.#context = context
    this.#server = createServer((request, response) => {
      void this.#receive(request).then((accepted) => {
        response.writeHead(accepted ? 204 : 400).end()
      })
    })
  }

  // The port the hooks name; 0 before start.
  get port(): number {
    return (this.#server.address() as AddressInfo | null)?.port ?? 0
  }

  // Listens on the port the hooks already name, so an unchanged install writes nothing.
  async start(): Promise<void> {
    const named = await this.#installedPort()
    await this.#listen(named ?? 0).catch(() => this.#listen(0))
    for (const { harness, external } of this.#context.harnesses)
      try {
        await external.hooks?.install(this.port)
      } catch (error) {
        this.#installFailures += 1
        console.warn(
          `Could not install the ${harness} status hooks (${this.#installFailures} failure(s)):`,
          error,
        )
      }
  }

  stop(): void {
    this.#server.close()
  }

  async #installedPort(): Promise<number | null> {
    for (const { external } of this.#context.harnesses) {
      const port = await external.hooks?.installedPort().catch(() => null)
      if (port != null) return port
    }
    return null
  }

  #listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.once('error', reject)
      this.#server.listen(port, '127.0.0.1', () => {
        this.#server.off('error', reject)
        resolve()
      })
    })
  }

  async #receive(request: IncomingMessage): Promise<boolean> {
    const [, harnessName, eventName] = HOOK_PATH.exec(request.url ?? '') ?? []
    const harness = harnessSchema.safeParse(harnessName).data
    const event = statusHookEventSchema.safeParse(eventName).data
    const hooks = this.#context.harnesses.find((each) => each.harness === harness)?.external.hooks
    const payload = parseJson(await readBody(request))
    const reading =
      request.method === 'POST' && event !== undefined ? hooks?.read(event, payload) : undefined
    if (harness === undefined || event === undefined || reading == null) {
      this.#rejected += 1
      console.warn(`Rejected ${this.#rejected} unrecognised status hook event(s).`)
      return false
    }
    this.#context.poll.hookEvent(harness, event, reading)
    return true
  }
}
