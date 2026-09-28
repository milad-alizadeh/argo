import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'

// A scope is what a failure belongs to, such as a draft owner or a Harness catalog.
export type ComposerFailure = {
  scope: string
  title: string
  retry?: () => void
}

type Shown = { scope: string; toastId: string | null; lasting: boolean }

function failureId(failure: ComposerFailure) {
  return `${failure.scope}\n${failure.title}`
}

// Closes the toasts of cleared failures and of scopes off screen. An off-screen lasting failure
// stays recorded, so a switch back does not raise it again.
function closeCleared(
  shown: Map<string, Shown>,
  now: { present: ReadonlySet<string>; onScreen: ReadonlySet<string> },
  close: (toastId: string) => void,
) {
  const { present, onScreen } = now
  for (const [id, toast] of shown) {
    const visible = onScreen.has(toast.scope)
    const cleared = toast.lasting && visible && !present.has(id)
    if (visible && !cleared) continue
    if (toast.toastId !== null) close(toast.toastId)
    toast.toastId = null
    if (cleared || !toast.lasting) shown.delete(id)
  }
}

// A lasting failure toasts once while it holds; a switch away closes its toast and a switch back
// does not raise it again. The returned function toasts one event, such as a failed Send, while
// its scope is on screen.
export function useComposerFailureToasts(
  failures: readonly ComposerFailure[],
  scopes: readonly string[],
) {
  const { t } = useTranslation('sessions')
  const { add, close } = useToastManager()
  const shown = useRef(new Map<string, Shown>())
  const events = useRef(0)
  const visibleScopes = useRef(scopes)
  visibleScopes.current = scopes
  const retries = useRef(new Map<string, () => void>())
  retries.current = new Map(
    failures.flatMap((failure) =>
      failure.retry === undefined ? [] : [[failureId(failure), failure.retry] as const],
    ),
  )
  const failureKey = JSON.stringify(failures.map(failureId))
  const scopeKey = JSON.stringify(scopes)
  useEffect(() => {
    const toasts = shown.current
    // A composer that unmounts takes its toasts with it.
    return () => {
      for (const { toastId } of toasts.values()) if (toastId !== null) close(toastId)
      toasts.clear()
    }
  }, [close])
  useEffect(() => {
    const present = new Set<string>(JSON.parse(failureKey))
    closeCleared(shown.current, { present, onScreen: new Set<string>(JSON.parse(scopeKey)) }, close)
    for (const id of present) {
      if (shown.current.has(id)) continue
      const [scope = '', title = ''] = id.split('\n')
      const retry = retries.current.has(id)
      const toastId = add({
        title,
        type: 'error',
        // A failure with a Retry stays until it clears or is dismissed.
        timeout: retry ? 0 : undefined,
        actionProps: retry
          ? { children: t('composer.retry'), onClick: () => retries.current.get(id)?.() }
          : undefined,
      })
      shown.current.set(id, { scope, toastId, lasting: true })
    }
  }, [add, close, failureKey, scopeKey, t])
  return useCallback(
    (failure: Omit<ComposerFailure, 'retry'>) => {
      if (!visibleScopes.current.includes(failure.scope)) return
      events.current += 1
      const toastId = add({ title: failure.title, type: 'error' })
      shown.current.set(`${failureId(failure)}\n${events.current}`, {
        scope: failure.scope,
        toastId,
        lasting: false,
      })
    },
    [add],
  )
}
