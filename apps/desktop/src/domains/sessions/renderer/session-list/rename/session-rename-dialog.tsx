import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/platform/renderer/components/ui/dialog'
import { Input } from '@/platform/renderer/components/ui/input'
import { Label } from '@/platform/renderer/components/ui/label'
import type { Session } from '../../types'
import { sessionName } from '../rows/session-list-rows'

// A failed rename keeps the dialog open with the reason inline.
export function SessionRenameDialog({
  onClose,
  onRename,
  session,
}: {
  onClose: () => void
  onRename: (session: Session, name: string) => Promise<void>
  session: Session | null
}) {
  const { t } = useTranslation('sessions')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const open = session !== null

  useEffect(() => {
    if (session === null) return
    setName(sessionName(session, t('newSession')))
    setError(null)
  }, [session, t])

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
      await onRename(session, name)
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
      <DialogContent showCloseButton={!saving}>
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
          {error === null ? null : (
            <p className="type-body text-destructive" id="session-name-error" role="alert">
              {error}
            </p>
          )}
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
