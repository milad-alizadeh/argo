// The appearance contract, shared by the bundled main process and renderer. System, Light and
// Dark, with System the default and System following the operating system (#1820).
import { z } from 'zod'
import { createDomainClient } from '../contract/domain'
import { type ContractError, errorFactory, errorSchema, message } from '../contract/messages'

export const APPEARANCE_CHANGED_CHANNEL = 'argo:appearance:changed'

export const APPEARANCES = ['system', 'light', 'dark'] as const
export const appearanceSchema = z.enum(APPEARANCES)
export type Appearance = z.infer<typeof appearanceSchema>

// The stored file. Another portable client may hold fields this build does not own, and a write
// must not delete them (docs/portable-integration-contracts.md).
export const appearanceDocumentSchema = z.object({ appearance: appearanceSchema }).passthrough()

// `dark` is the resolved answer: what the window actually draws once System has asked the
// operating system. The renderer needs both, because the control shows the choice and the page
// shows the resolution. This is also the push channel's shape, which carries no request id.
export const appearanceStateSchema = z.strictObject({
  appearance: appearanceSchema,
  dark: z.boolean(),
})
export type AppearanceState = z.infer<typeof appearanceStateSchema>

export const appearanceReplySchema = message('appearance.state', {
  appearance: appearanceSchema,
  dark: z.boolean(),
})
export type AppearanceReply = z.infer<typeof appearanceReplySchema>

export const APPEARANCE_ERRORS = {
  'access-denied': 'Argo cannot change the appearance from here.',
  'unsupported-version': 'This Appearance contract version is not supported.',
  'invalid-request': 'The Appearance request is invalid.',
  'invalid-response': 'Argo received an invalid Appearance response.',
  'connection-lost': 'The connection to Argo was lost.',
} as const
export type AppearanceErrorCode = keyof typeof APPEARANCE_ERRORS
export type AppearanceError = ContractError<'appearance.error', AppearanceErrorCode>
export const appearanceError = errorFactory('appearance.error', APPEARANCE_ERRORS)
const appearanceErrorSchema = errorSchema('appearance.error', APPEARANCE_ERRORS)

// Appearance has two operations on their own channels: `get` reads the current state, `set`
// changes it. Both reply with the same state shape, or the domain's own error.
export const APPEARANCE_OPERATIONS = {
  get: {
    name: 'appearance.get',
    channel: 'argo:appearance:get',
    request: message('appearance.get', {}),
    reply: appearanceReplySchema.or(appearanceErrorSchema),
  },
  set: {
    name: 'appearance.set',
    channel: 'argo:appearance:set',
    request: message('appearance.set', { appearance: appearanceSchema }),
    reply: appearanceReplySchema.or(appearanceErrorSchema),
  },
} as const

export const DEFAULT_APPEARANCE: Appearance = 'system'

// The one place a design token is restated outside CSS. A `BrowserWindow` paints its ground before
// the renderer exists and cannot read a stylesheet, so these mirror `--background` in
// `src/renderer/styles/globals.css`: `oklch(1 0 0)` light, `oklch(0.145 0 0)` dark. Change one and
// change the other, or the window flashes the wrong ground on every launch.
export const WINDOW_BACKGROUND = { light: '#ffffff', dark: '#0a0a0a' } as const

export function windowBackground(dark: boolean): string {
  return dark ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light
}

export function isAppearance(value: unknown): value is Appearance {
  return appearanceSchema.safeParse(value).success
}

export function isAppearanceState(value: unknown): value is AppearanceState {
  return appearanceStateSchema.safeParse(value).success
}

export type AppearanceClient = {
  getAppearance(): Promise<AppearanceState>
  setAppearance(appearance: Appearance): Promise<AppearanceState>
  onAppearanceChanged(listener: (state: AppearanceState) => void): () => void
}

// A window that cannot read its own appearance, or whose change was refused, still has to draw.
// Dark is the fallback because it is what an unresolved System draws on the reference machine, so
// a failed read never flashes a light window over a dark desktop.
const FALLBACK: AppearanceState = { appearance: DEFAULT_APPEARANCE, dark: true }

function stateOf(reply: AppearanceReply | AppearanceError): AppearanceState {
  return reply.type === 'appearance.error'
    ? FALLBACK
    : { appearance: reply.appearance, dark: reply.dark }
}

export function createAppearanceClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
  subscribe: (listener: (state: unknown) => void) => () => void,
): AppearanceClient {
  const client = createDomainClient(APPEARANCE_OPERATIONS, invoke, appearanceError)
  return {
    getAppearance: async () => stateOf(await client.get()),
    // An appearance the contract does not name is never sent as a change: the renderer reads the
    // current state back instead of asking the main process to reject its own request.
    setAppearance: async (appearance) =>
      stateOf(await (isAppearance(appearance) ? client.set({ appearance }) : client.get())),
    // The disposer is what keeps a remounted component from leaving a listener behind: React runs a
    // mount effect twice in development, and a subscription with no undo is then permanent.
    onAppearanceChanged(listener) {
      return subscribe((state) => {
        if (isAppearanceState(state)) listener(state)
      })
    },
  }
}
