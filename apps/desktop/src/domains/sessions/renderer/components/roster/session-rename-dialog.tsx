import { useEffect, useState } from 'react'
import { Button } from '../../../../../platform/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../platform/renderer/components/ui/dialog'
import { Input } from '../../../../../platform/renderer/components/ui/input'
import { Label } from '../../../../../platform/renderer/components/ui/label'
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
      setError('Enter a name for this Session.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onRename(session, normalized)
      onOpenChange(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Argo could not rename this Session.')
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
          <DialogTitle>Rename Session</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Label htmlFor="session-name">Name</Label>
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
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
