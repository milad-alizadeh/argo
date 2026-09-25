import { useCallback } from 'react'

import type {
  SessionRosterRow,
  SessionTurnConfiguration,
} from '@/domains/sessions/renderer/model/models'
import type { SessionHarness } from '../../harness/harnesses'
import { useComposerStore } from '../hooks/use-composer-store'
import { type ComposerIdentity, composerIdentityKey } from '../identity/composer-identity'
import type { TurnConfigurationControlProps } from '../toolbar/turn-configuration-menu'
import {
  configurationFromReading,
  supportedConfiguration,
  type TurnConfiguration,
  type TurnConfigurationChoices,
} from './turn-configuration'

// A draft uses its stored choice, then its remembered Model and Effort. A Session uses the roster.
export function resolvedTurnConfiguration(
  choices: TurnConfigurationChoices,
  request: {
    identity: ComposerIdentity
    chosen: Map<string, TurnConfiguration>
    rows: readonly { id: string; turnConfiguration: SessionTurnConfiguration }[]
    remembered: Partial<Pick<TurnConfiguration, 'model' | 'effort'>>
  },
): TurnConfiguration {
  const { identity, chosen, rows, remembered } = request
  const explicit = chosen.get(composerIdentityKey(identity))
  if (explicit !== undefined) return supportedConfiguration(choices, explicit, choices.opening)
  const row =
    identity.kind === 'session' ? rows.find(({ id }) => id === identity.sessionId) : undefined
  return row === undefined
    ? supportedConfiguration(choices, { ...choices.opening, ...remembered }, choices.opening)
    : configurationFromReading(choices, row.turnConfiguration)
}

export function useTurnConfiguration({
  harness,
  choices,
  identity,
  rows,
}: {
  harness: SessionHarness
  choices: TurnConfigurationChoices | null
  identity: ComposerIdentity
  rows: SessionRosterRow[]
}): TurnConfigurationControlProps | null {
  const chosen = useComposerStore(({ turnConfiguration }) => turnConfiguration)
  const chooseTurnConfiguration = useComposerStore(
    ({ chooseTurnConfiguration }) => chooseTurnConfiguration,
  )
  const remembered = useComposerStore(
    ({ rememberedTurnConfiguration }) => rememberedTurnConfiguration[harness],
  )
  const rememberTurnConfiguration = useComposerStore(
    ({ rememberTurnConfiguration }) => rememberTurnConfiguration,
  )

  const onChange = useCallback(
    (turnConfiguration: TurnConfiguration) => {
      chooseTurnConfiguration(composerIdentityKey(identity), turnConfiguration)
      rememberTurnConfiguration(harness, {
        model: turnConfiguration.model,
        effort: turnConfiguration.effort,
      })
    },
    [chooseTurnConfiguration, harness, identity, rememberTurnConfiguration],
  )
  if (choices === null) return null
  const value = resolvedTurnConfiguration(choices, {
    identity,
    chosen: new Map(Object.entries(chosen)),
    rows,
    remembered: remembered ?? {},
  })
  return { choices, value, onChange }
}
