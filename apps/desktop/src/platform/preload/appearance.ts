import {
  APPEARANCE_OPERATIONS,
  type Appearance,
  type AppearanceError,
  type AppearanceReply,
  type AppearanceState,
  appearanceError,
  DEFAULT_APPEARANCE,
  isAppearance,
  isAppearanceState,
} from '@/platform/shared/appearance'
import { createDomainClient } from '@/shared/ipc/client'

export type AppearanceClient = {
  getAppearance(): Promise<AppearanceState>
  setAppearance(appearance: Appearance): Promise<AppearanceState>
  onAppearanceChanged(listener: (state: AppearanceState) => void): () => void
}

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
    setAppearance: async (appearance) =>
      stateOf(await (isAppearance(appearance) ? client.set({ appearance }) : client.get())),
    onAppearanceChanged(listener) {
      return subscribe((state) => {
        if (isAppearanceState(state)) listener(state)
      })
    },
  }
}
