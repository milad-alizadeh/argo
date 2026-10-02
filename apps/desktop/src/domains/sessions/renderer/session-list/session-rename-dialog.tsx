import type { TFunction } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/platform/renderer/components/ui/dialog'
import { FieldError } from '@/platform/renderer/components/ui/field'
import { Input } from '@/platform/renderer/components/ui/input'
import { Label } from '@/platform/renderer/components/ui/label'
import { trpcClient } from '@/platform/renderer/trpc-client'
import type { Session } from '../types'

type SessionRenameFormProps = {
  onClose: () => void
  saving: boolean
  session: Session | null
  setSaving: (saving: boolean) => void
}

type SaveSessionRenameInput = {
  name: string
  onClose: () => void
  session: Session | null
  setError: (error: string | null) => void
  setSaving: (saving: boolean) => void
  t: TFunction<'sessions'>
}

function useSessionReturnFocus(session: Session | null) {
  const focusSessionId = useRef<string | null>(null)
  useEffect(() => {
    if (session !== null) focusSessionId.current = session.id
  }, [session])
  return () => {
    const sessionId = focusSessionId.current
    if (sessionId === null) return true
    return (
      [...document.querySelectorAll<HTMLElement>('[data-session-id]')].find(
        (element) => element.dataset.sessionId === sessionId,
      ) ?? true
    )
  }
}

async function saveSessionRename({
  name,
  onClose,
  session,
  setError,
  setSaving,
  t,
}: SaveSessionRenameInput) {
  if (session === null) return
  setSaving(true)
  setError(null)
  try {
    await trpcClient.sessionUpdate.mutate({ sessionIds: [session.id], title: name })
    onClose()
  } catch (reason) {
    setError(reason instanceof Error ? reason.message : t('rename.failure'))
  } finally {
    setSaving(false)
  }
}

function SessionRenameForm({ onClose, saving, session, setSaving }: SessionRenameFormProps) {
  const { t } = useTranslation('sessions')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (session === null) return
    setName(session.name)
    setError(null)
  }, [session])

  const close = () => {
    if (!saving) onClose()
  }
  const save = () => {
    if (session === null || saving) return
    if (name.trim() === '') {
      setError(t('rename.enterName'))
      return
    }
    void saveSessionRename({ name, onClose, session, setError, setSaving, t })
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <Label htmlFor="session-name">{t('rename.name')}</Label>
      <Input
        aria-describedby={error === null ? undefined : 'session-name-error'}
        aria-invalid={error !== null}
        autoFocus
        disabled={saving}
        id="session-name"
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      {error === null ? null : <FieldError id="session-name-error">{error}</FieldError>}
      <DialogFooter>
        <Button disabled={saving} onClick={close} type="button" variant="outline">
          {t('rename.cancel')}
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? t('rename.saving') : t('rename.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

// A failed rename keeps the dialog open with the reason inline.
export function SessionRenameDialog({
  onClose,
  session,
}: {
  onClose: () => void
  session: Session | null
}) {
  const { t } = useTranslation('sessions')
  const returnFocus = useSessionReturnFocus(session)
  const [saving, setSaving] = useState(false)
  const close = () => {
    if (!saving) onClose()
  }
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={session !== null}
    >
      <DialogContent finalFocus={returnFocus} showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t('rename.title')}</DialogTitle>
        </DialogHeader>
        <SessionRenameForm
          onClose={close}
          saving={saving}
          session={session}
          setSaving={setSaving}
        />
      </DialogContent>
    </Dialog>
  )
}
