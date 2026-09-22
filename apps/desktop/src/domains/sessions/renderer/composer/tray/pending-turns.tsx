import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PendingTurnActions } from '@/domains/sessions/renderer/composer/tray/pending-turn-actions'
import type { PendingTurn } from '@/domains/sessions/renderer/composer/tray/use-pending-turns'
import { Icon } from '@/platform/renderer/components/icon/icon'
import {
  attachmentExitDelay,
  focusMessageField,
} from '@/platform/renderer/components/permission/exit-presence'

function queuedMessageClassName(
  id: string,
  enteringTurnId: string | null,
  exitingTurnId: string | null,
) {
  if (exitingTurnId === id) {
    return 'session-page__queued-message cursor-grab active:cursor-grabbing session-page__queued-message--exit'
  }
  if (enteringTurnId === id) {
    return 'session-page__queued-message cursor-grab active:cursor-grabbing session-page__queued-message--enter'
  }
  return 'session-page__queued-message cursor-grab active:cursor-grabbing'
}

function restoreFocusAfterRemoval(listRef: RefObject<HTMLUListElement | null>) {
  const nextControl = listRef.current?.querySelector<HTMLButtonElement>('button')
  if (nextControl) nextControl.focus()
  else focusMessageField()
}

function useQueueAnimations(
  turns: PendingTurn[],
  onRemove: (id: string) => void,
  listRef: RefObject<HTMLUListElement | null>,
) {
  const knownTurnIdsRef = useRef(new Set(turns.map((turn) => turn.id)))
  const exitTimerRef = useRef<number | null>(null)
  const [enteringTurnId, setEnteringTurnId] = useState<string | null>(null)
  const [exitingTurnId, setExitingTurnId] = useState<string | null>(null)
  const [restoreFocus, setRestoreFocus] = useState(false)

  useEffect(() => {
    const enteringTurn = turns.find((turn) => !knownTurnIdsRef.current.has(turn.id))
    knownTurnIdsRef.current = new Set(turns.map((turn) => turn.id))
    if (!enteringTurn) return
    setEnteringTurnId(enteringTurn.id)
    const enterTimer = window.setTimeout(() => setEnteringTurnId(null), 340)
    return () => window.clearTimeout(enterTimer)
  }, [turns])

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    },
    [],
  )

  useLayoutEffect(() => {
    if (!restoreFocus) return
    restoreFocusAfterRemoval(listRef)
    setRestoreFocus(false)
  }, [listRef, restoreFocus])

  const removeTurn = (id: string) => {
    if (exitingTurnId) return
    setExitingTurnId(id)
    exitTimerRef.current = window.setTimeout(() => {
      onRemove(id)
      setExitingTurnId(null)
      setRestoreFocus(true)
    }, attachmentExitDelay())
  }

  return { enteringTurnId, exitingTurnId, removeTurn }
}

export function PendingTurns({
  turns,
  onEdit,
  onSteer,
  onRemove,
  onReorder,
}: {
  turns: PendingTurn[]
  onEdit: (turn: PendingTurn) => void
  onSteer: (turn: PendingTurn) => Promise<boolean>
  onRemove: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
}) {
  const { t } = useTranslation('sessions')
  const listRef = useRef<HTMLUListElement>(null)
  const { enteringTurnId, exitingTurnId, removeTurn } = useQueueAnimations(turns, onRemove, listRef)

  if (turns.length === 0) return null
  return (
    <section aria-label={t('composer.pendingTurns')}>
      <ul ref={listRef}>
        {turns.map((turn) => (
          <li
            key={turn.id}
            draggable
            className={queuedMessageClassName(turn.id, enteringTurnId, exitingTurnId)}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', turn.id)
            }}
            onDrop={(event) => onReorder(event.dataTransfer.getData('text/plain'), turn.id)}
          >
            <Icon name="drag-handle" className="size-4 shrink-0 text-muted-foreground" />
            <Icon name="queued-turn-path" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate type-body">{turn.text}</span>
            <span className="sr-only">{t('composer.queued.reorder')}</span>
            <PendingTurnActions
              onEdit={onEdit}
              onRemove={removeTurn}
              onSteer={onSteer}
              turn={turn}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
