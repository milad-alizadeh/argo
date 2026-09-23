import { useCallback, useEffect, useState } from 'react'

import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionHarness } from '../../harness/harnesses'
import { useComposerStore } from '../hooks/use-composer-store'
import { type ComposerIdentity, composerIdentityKey } from '../identity/composer-identity'
import type { TurnSetupControlProps } from '../toolbar/run-setup-menu'
import {
  refusalOf,
  resolvedTurnSetup,
  type TurnSetup,
  type TurnSetupChoices,
  turnSettled,
} from './turn-setup'

type Expectation = { requested: TurnSetup; since: string | null }

export function useTurnSetup({
  harness,
  choices,
  identity,
  rows,
  onRefusal,
}: {
  harness: SessionHarness
  choices: TurnSetupChoices | null
  identity: ComposerIdentity
  rows: SessionRosterRow[]
  onRefusal: (refusal: { sessionId: string; message: string }) => void
}) {
  const [expectations, setExpectations] = useState(() => new Map<string, Expectation>())
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

  const watchTurn = useCallback(
    (sessionId: string, requested: TurnSetup, since: string | null) => {
      chooseSetup(sessionId, requested)
      setExpectations((current) => new Map(current).set(sessionId, { requested, since }))
    },
    [chooseSetup],
  )

  useEffect(() => {
    if (choices === null) return
    for (const [sessionId, { requested, since }] of expectations) {
      const row = rows.find(({ id }) => id === sessionId)
      if (row === undefined || !turnSettled(row, since)) continue
      setExpectations((current) => {
        const next = new Map(current)
        next.delete(sessionId)
        return next
      })
      const refusal = refusalOf(choices, requested, row.setup)
      if (refusal === null) continue
      choose(sessionId, refusal.setup)
      onRefusal({ sessionId, message: refusal.message })
    }
  }, [choices, choose, expectations, onRefusal, rows])

  const control = useComposerControl({
    choices,
    chosen: new Map(Object.entries(chosen)),
    identity,
    rows,
    remembered,
    choose,
  })
  return { control, watchTurn }
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
