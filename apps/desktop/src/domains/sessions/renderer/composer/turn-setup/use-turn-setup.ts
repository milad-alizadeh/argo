import { useCallback } from 'react'

import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionHarness } from '../../harness/harnesses'
import { useComposerStore } from '../hooks/use-composer-store'
import { type ComposerIdentity, composerIdentityKey } from '../identity/composer-identity'
import type { TurnSetupControlProps } from '../toolbar/run-setup-menu'
import { resolvedTurnSetup, type TurnSetup, type TurnSetupChoices } from './turn-setup'

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
}) {
  const chosen = useComposerStore(({ setup }) => setup)
  const chooseSetup = useComposerStore(({ chooseSetup }) => chooseSetup)
  const remembered = useComposerStore(({ rememberedSetup }) => rememberedSetup[harness])
  const rememberSetup = useComposerStore(({ rememberSetup }) => rememberSetup)

  const choose = useCallback(
    (key: string, setup: TurnSetup) => {
      chooseSetup(key, setup)
      rememberSetup(harness, { model: setup.model, effort: setup.effort })
    },
    [chooseSetup, harness, rememberSetup],
  )

  const control = useComposerControl({
    choices,
    chosen: new Map(Object.entries(chosen)),
    identity,
    rows,
    remembered,
    choose,
  })
  return control
}

function useComposerControl({
  choices,
  chosen,
  identity,
  rows,
  remembered,
  choose,
}: {
  choices: TurnSetupChoices | null
  chosen: Map<string, TurnSetup>
  identity: ComposerIdentity
  rows: SessionRosterRow[]
  remembered: Pick<TurnSetup, 'model' | 'effort'> | undefined
  choose: (key: string, setup: TurnSetup) => void
}): TurnSetupControlProps | null {
  const onChange = useCallback(
    (setup: TurnSetup) => choose(composerIdentityKey(identity), setup),
    [choose, identity],
  )
  if (choices === null) return null
  const value = resolvedTurnSetup(choices, {
    identity,
    chosen,
    rows,
    remembered: remembered ?? {},
  })
  return { choices, value, onChange }
}
