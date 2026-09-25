import { useCallback } from 'react'

import type { SessionRosterRow, SessionSetup } from '@/domains/sessions/renderer/model/models'
import type { SessionHarness } from '../../harness/harnesses'
import { useComposerStore } from '../hooks/use-composer-store'
import { type ComposerIdentity, composerIdentityKey } from '../identity/composer-identity'
import type { TurnSetupControlProps } from '../toolbar/run-setup-menu'
import {
  setupFromReading,
  supportedSetup,
  type TurnSetup,
  type TurnSetupChoices,
} from './turn-setup'

// A draft uses its stored choice, then its remembered Model and Effort. A Session uses the roster.
export function resolvedTurnSetup(
  choices: TurnSetupChoices,
  request: {
    identity: ComposerIdentity
    chosen: Map<string, TurnSetup>
    rows: readonly { id: string; setup: SessionSetup }[]
    remembered: Partial<Pick<TurnSetup, 'model' | 'effort'>>
  },
): TurnSetup {
  const { identity, chosen, rows, remembered } = request
  const explicit = chosen.get(composerIdentityKey(identity))
  if (explicit !== undefined) return supportedSetup(choices, explicit, choices.opening)
  const row =
    identity.kind === 'session' ? rows.find(({ id }) => id === identity.sessionId) : undefined
  return row === undefined
    ? supportedSetup(choices, { ...choices.opening, ...remembered }, choices.opening)
    : setupFromReading(choices, row.setup)
}

export function useTurnSetup({
  harness,
  choices,
  identity,
  rows,
}: {
  harness: SessionHarness
  choices: TurnSetupChoices | null
  identity: ComposerIdentity
  rows: SessionRosterRow[]
}): TurnSetupControlProps | null {
  const chosen = useComposerStore(({ setup }) => setup)
  const chooseSetup = useComposerStore(({ chooseSetup }) => chooseSetup)
  const remembered = useComposerStore(({ rememberedSetup }) => rememberedSetup[harness])
  const rememberSetup = useComposerStore(({ rememberSetup }) => rememberSetup)

  const onChange = useCallback(
    (setup: TurnSetup) => {
      chooseSetup(composerIdentityKey(identity), setup)
      rememberSetup(harness, { model: setup.model, effort: setup.effort })
    },
    [chooseSetup, harness, identity, rememberSetup],
  )
  if (choices === null) return null
  const value = resolvedTurnSetup(choices, {
    identity,
    chosen: new Map(Object.entries(chosen)),
    rows,
    remembered: remembered ?? {},
  })
  return { choices, value, onChange }
}
