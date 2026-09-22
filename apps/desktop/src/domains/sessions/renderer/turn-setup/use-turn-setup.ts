import { useComposerStore } from '../composer/hooks'
import { type ComposerIdentity, composerIdentityKey } from '../composer/identity'
import type { TurnSetupControlProps } from '../composer/toolbar'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'

import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import {
  refusalOf,
  resolvedTurnSetup,
  type TurnSetup,
  type TurnSetupChoices,
  turnSettled,
} from './turn-setup'

// Each harness remembers its own Model and Effort for a new composer (CONTEXT.md L2 · Model and Effort).
const REMEMBERED_STORAGE_KEY = 'argo.composer-model-effort'
const rememberedSchema = z.record(
  z.string(),
  z.strictObject({ model: z.string(), effort: z.string() }),
)
type Remembered = z.infer<typeof rememberedSchema>

type Expectation = { requested: TurnSetup; since: string | null }

function restoredRemembered(): Remembered {
  try {
    const parsed = rememberedSchema.safeParse(
      JSON.parse(window.localStorage.getItem(REMEMBERED_STORAGE_KEY) ?? '{}'),
    )
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function persistRemembered(remembered: Remembered) {
  try {
    window.localStorage.setItem(REMEMBERED_STORAGE_KEY, JSON.stringify(remembered))
  } catch {}
}

export function useTurnSetup({
  harness,
  choices,
  identity,
  rows,
  onRefusal,
}: {
  harness: string
  choices: TurnSetupChoices | null
  identity: ComposerIdentity
  rows: SessionRosterRow[]
  onRefusal: (refusal: { sessionId: string; message: string }) => void
}) {
  const [remembered, setRemembered] = useState(restoredRemembered)
  const [expectations, setExpectations] = useState(() => new Map<string, Expectation>())
  const chosen = useComposerStore(({ setup }) => setup)
  const chooseSetup = useComposerStore(({ chooseSetup }) => chooseSetup)

  useEffect(() => persistRemembered(remembered), [remembered])

  const choose = useCallback(
    (key: string, setup: TurnSetup) => {
      chooseSetup(key, setup)
      setRemembered((current) => ({
        ...current,
        [harness]: { model: setup.model, effort: setup.effort },
      }))
    },
    [chooseSetup, harness],
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
    harness,
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
  harness,
  choose,
}: {
  choices: TurnSetupChoices | null
  chosen: Map<string, TurnSetup>
  identity: ComposerIdentity
  rows: SessionRosterRow[]
  remembered: Remembered
  harness: string
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
    remembered: remembered[harness] ?? {},
  })
  return { choices, value, onChange }
}
