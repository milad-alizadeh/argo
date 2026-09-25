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

export function normalizeSessionName(value: string): string {
  return [...value]
    .map((character) =>
      (character.codePointAt(0) ?? 0) < 32 ||
      ((character.codePointAt(0) ?? 0) >= 127 && (character.codePointAt(0) ?? 0) <= 159)
        ? ' '
        : character,
    )
    .join('')
    .trim()
    .replace(/\s+/g, ' ')
}

export function SessionRenameDialog({
  onOpenChange,
  onRename,
  session,
}: {
  onOpenChange: (open: boolean) => void
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
    setName(session.title?.text ?? session.id)
    setError(null)
  }, [session])

  const close = () => {
    if (saving) return
    onOpenChange(false)
  }
  const save = async () => {
    if (session === null || saving) return
    const normalized = normalizeSessionName(name)
    if (normalized.length === 0) {
      setError(t('rename.enterName'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onRename(session, normalized)
      onOpenChange(false)
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
