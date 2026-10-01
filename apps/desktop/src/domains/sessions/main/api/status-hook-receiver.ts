import { rm } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { installStatusHooks, readStatusHook } from '@/harnesses/host/status-hooks'
import type { ExternalSessions } from '@/harnesses/registration'
import type { ExternalSessionPoll } from './external-session-poll'

// A hook payload is one JSON object; anything larger is not one Argo installed.
const BODY_LIMIT_BYTES = 1024 * 1024
const HOOK_PATH = /^\/h\/([^/]+)$/

type StatusHookReceiverContext = {
  poll: ExternalSessionPoll
  harnesses: readonly { harness: Harness; external: ExternalSessions }[]
  // In Argo's app data folder, so the hook command stays the same across launches.
  socketPath: string
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

// Installs every Harness's status hooks once, globally, naming one Unix socket, and passes what
// they post to the poll. A failed install leaves that Harness on the poll alone.
export class StatusHookReceiver {
  readonly #context: StatusHookReceiverContext
  readonly #server: Server
  #rejected = 0
  #installFailures = 0
  #stopped = false

  constructor(context: StatusHookReceiverContext) {
    this.#context = context
    this.#server = createServer((request, response) => {
      this.#receive(request).then(
        (accepted) => response.writeHead(accepted ? 204 : 400).end(),
        (error: unknown) => {
          console.warn('Could not take a status hook event:', error)
          response.writeHead(500).end()
        },
      )
    })
  }

  // The single-instance lock keeps one Argo per app data folder, so a socket already there was
  // left by one that did not close.
  async start(): Promise<void> {
    const { socketPath, harnesses } = this.#context
    await rm(socketPath, { force: true })
    await new Promise<void>((resolve, reject) => {
      this.#server.once('error', reject)
      this.#server.listen(socketPath, () => {
        this.#server.off('error', reject)
        resolve()
      })
    })
    if (this.#stopped) {
      this.#server.close()
      return
    }
    for (const { harness, external } of harnesses)
      try {
        if (external.hooks !== undefined)
          await installStatusHooks(harness, external.hooks, socketPath)
      } catch (error) {
        this.#installFailures += 1
        console.warn(
          `Could not install the ${harness} status hooks (${this.#installFailures} failure(s)):`,
          error,
        )
      }
  }

  // Safe before start finishes: a listen still under way closes once it lands.
  stop(): void {
    this.#stopped = true
    if (this.#server.listening) this.#server.close()
  }

  async #receive(request: IncomingMessage): Promise<boolean> {
    const harness = harnessSchema.safeParse(HOOK_PATH.exec(request.url ?? '')?.[1]).data
    const hooks = this.#context.harnesses.find((each) => each.harness === harness)?.external.hooks
    if (request.method !== 'POST' || harness === undefined || hooks === undefined)
      return this.#reject()
    const payload: unknown = await readBody(request)
      .then((text) => JSON.parse(text ?? ''))
      .catch(() => undefined)
    const reading = readStatusHook(hooks, payload)
    if (reading === null) return this.#reject()
    this.#context.poll.hookEvent(harness, reading)
    return true
  }

  #reject(): false {
    this.#rejected += 1
    console.warn(`Rejected ${this.#rejected} unrecognised status hook event(s).`)
    return false
  }
}
