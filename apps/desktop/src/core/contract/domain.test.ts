// The whole channel, proved once against a throwaway domain: registration and client are driven
// exactly as a real domain drives them, over the fake window in test-support.ts.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { createDomainClient, registerDomainHandlers } from './domain'
import { errorFactory, errorSchema, message } from './messages'
import { createFakeIpcWindow, RENDERER_URL } from './test-support'

const ECHO_ERRORS = {
  'access-denied': 'Argo cannot do this from here.',
  'unsupported-version': 'This contract version is not supported.',
  'invalid-request': 'The request is invalid.',
  'invalid-response': 'Argo received an invalid response.',
  'connection-lost': 'The connection to Argo was lost.',
  'not-found': 'That name is not registered.',
} as const
type EchoErrorCode = keyof typeof ECHO_ERRORS
const echoError = errorFactory('echo.error', ECHO_ERRORS)
const echoErrorSchema = errorSchema('echo.error', ECHO_ERRORS)

const echoRequest = message('echo.say', { name: z.string().min(1) })
const echoReply = message('echo.said', { name: z.string() }).or(echoErrorSchema)

const OPERATIONS = {
  say: { name: 'echo.say', channel: 'test:echo:say', request: echoRequest, reply: echoReply },
} as const

type Context = { refuse: string | null }

function attach(context: Context = { refuse: null }) {
  const fake = createFakeIpcWindow()
  registerDomainHandlers({
    window: fake.window,
    rendererURL: RENDERER_URL,
    operations: OPERATIONS,
    context,
    handlers: {
      say: (request, ctx) =>
        ctx.refuse === request.name
          ? echoError('not-found', request.requestId)
          : ({
              version: 1 as const,
              type: 'echo.said' as const,
              requestId: request.requestId,
              name: request.name,
            } satisfies z.infer<typeof echoReply>),
    },
    error: echoError,
  })
  return fake
}

function client(invoke: (channel: string, request: unknown) => Promise<unknown>) {
  return createDomainClient(OPERATIONS, invoke, echoError)
}

test('answers a trusted, well formed request', async () => {
  const fake = attach()
  const said = await client(fake.trustedInvoke).say({ name: 'argo' })
  assert.deepEqual(said, { version: 1, type: 'echo.said', requestId: said.requestId, name: 'argo' })
})

test('refuses an untrusted frame with access-denied, not the handler result', async () => {
  const fake = attach()
  const said = await client(fake.untrustedInvoke).say({ name: 'argo' })
  assert.equal(said.type, 'echo.error')
  assert.equal((said as { code: EchoErrorCode }).code, 'access-denied')
})

test('refuses a request naming another contract version', async () => {
  const fake = attach()
  const reply = await fake.trustedInvoke('test:echo:say', {
    version: 2,
    type: 'echo.say',
    requestId: 'r1',
    name: 'argo',
  })
  assert.equal((reply as { code: EchoErrorCode }).code, 'unsupported-version')
})

test('refuses a malformed request before it reaches the handler', async () => {
  const fake = attach()
  const reply = await fake.trustedInvoke('test:echo:say', {
    version: 1,
    type: 'echo.say',
    requestId: 'r1',
    name: '',
  })
  assert.equal((reply as { code: EchoErrorCode }).code, 'invalid-request')
})

test('the handler receives the parsed request, not the raw value', async () => {
  const fake = attach({ refuse: 'blocked' })
  const reply = await fake.trustedInvoke('test:echo:say', {
    version: 1,
    type: 'echo.say',
    requestId: 'r1',
    name: 'blocked',
  })
  assert.equal((reply as { code: EchoErrorCode }).code, 'not-found')
})

test('the renderer refuses a reply outside its schema', async () => {
  const said = await client(async () => ({ nonsense: true })).say({ name: 'argo' })
  assert.equal(said.type, 'echo.error')
  assert.equal((said as { code: EchoErrorCode }).code, 'invalid-response')
})

test('the renderer refuses a reply that answers another request', async () => {
  const said = await client(async (_channel, request) => ({
    version: 1,
    type: 'echo.said',
    requestId: `not-${(request as { requestId: string }).requestId}`,
    name: 'argo',
  })).say({ name: 'argo' })
  assert.equal(said.type, 'echo.error')
  assert.equal((said as { code: EchoErrorCode }).code, 'invalid-response')
})

test('a rejected invoke becomes connection-lost, not an exception', async () => {
  const said = await client(async () => {
    throw new Error('credential-secret')
  }).say({ name: 'argo' })
  assert.equal(said.type, 'echo.error')
  assert.equal((said as { code: EchoErrorCode }).code, 'connection-lost')
})

test('each operation gets its own channel', () => {
  const fake = attach()
  assert.deepEqual(fake.channels(), ['test:echo:say'])
})
