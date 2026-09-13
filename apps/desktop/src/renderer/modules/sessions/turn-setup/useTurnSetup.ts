import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'

import type { SessionRosterRow } from '@/core/sessions/models'
import type { TurnSetupControlProps } from '../components/RunSetupMenu'
import {
  refusalOf,
  setupFromReading,
  supportedSetup,
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
  cli,
  choices,
  composerKey,
  rows,
  onRefusal,
}: {
  cli: string
  choices: TurnSetupChoices | null
  composerKey: string
  rows: SessionRosterRow[]
  onRefusal: (refusal: { sessionId: string; message: string }) => void
}) {
  const [chosen, setChosen] = useState(() => new Map<string, TurnSetup>())
  const [remembered, setRemembered] = useState(restoredRemembered)
  const [expectations, setExpectations] = useState(() => new Map<string, Expectation>())

  useEffect(() => persistRemembered(remembered), [remembered])

  const choose = useCallback(
    (key: string, setup: TurnSetup) => {
      setChosen((current) => new Map(current).set(key, setup))
      setRemembered((current) => ({
        ...current,
        [cli]: { model: setup.model, effort: setup.effort },
      }))
    },
    [cli],
  )

  const watchTurn = useCallback((sessionId: string, requested: TurnSetup, since: string | null) => {
    setChosen((current) => new Map(current).set(sessionId, requested))
    setExpectations((current) => new Map(current).set(sessionId, { requested, since }))
  }, [])

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
    chosen,
    composerKey,
    rows,
    remembered,
    cli,
    choose,
  })
  return { control, watchTurn }
}

function useComposerControl({
  choices,
  chosen,
  composerKey,
  rows,
  remembered,
  cli,
  choose,
}: {
  choices: TurnSetupChoices | null
  chosen: Map<string, TurnSetup>
  composerKey: string
  rows: SessionRosterRow[]
  remembered: Remembered
  cli: string
  choose: (key: string, setup: TurnSetup) => void
}): TurnSetupControlProps | null {
  const onChange = useCallback(
    (setup: TurnSetup) => choose(composerKey, setup),
    [choose, composerKey],
  )
  if (choices === null) return null
  const row = rows.find(({ id }) => id === composerKey)
  const opening = supportedSetup(
    choices,
    { ...choices.opening, ...remembered[cli] },
    choices.opening,
  )
  const value =
    chosen.get(composerKey) ?? (row === undefined ? opening : setupFromReading(choices, row.setup))
  return { choices, value, onChange }
}
