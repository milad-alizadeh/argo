import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import { FieldError } from '@/platform/renderer/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/platform/renderer/components/ui/dialog'
import { Input } from '@/platform/renderer/components/ui/input'
import { Label } from '@/platform/renderer/components/ui/label'
import { trpcClient } from '@/platform/renderer/trpc-client'
import type { Session } from '../types'

// A failed rename keeps the dialog open with the reason inline.
export function SessionRenameDialog({
  onClose,
  session,
}: {
  onClose: () => void
  session: Session | null
}) {
  const { t } = useTranslation('sessions')
  const focusSessionId = useRef<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const open = session !== null

  useEffect(() => {
    if (session === null) return
    focusSessionId.current = session.id
    setName(session.name)
    setError(null)
  }, [session])

  const returnFocus = () => {
    const sessionId = focusSessionId.current
    if (sessionId === null) return true
    return (
      [...document.querySelectorAll<HTMLElement>('[data-session-id]')].find(
        (element) => element.dataset.sessionId === sessionId,
      ) ?? true
    )
  }

  const close = () => {
    if (saving) return
    onClose()
  }
  const save = async () => {
    if (session === null || saving) return
    if (name.trim() === '') {
      setError(t('rename.enterName'))
      return
    }
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

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={open}
    >
      <DialogContent finalFocus={returnFocus} showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{t('rename.title')}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
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
      </DialogContent>
    </Dialog>
  )
}
