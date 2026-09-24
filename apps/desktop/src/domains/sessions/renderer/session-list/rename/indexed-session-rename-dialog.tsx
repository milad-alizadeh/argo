import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionListItem } from '@/domains/sessions/contract/session-list'
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
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'

function normalizeSessionName(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint < 32 || (codePoint >= 127 && codePoint <= 159) ? ' ' : character
    })
    .join('')
    .trim()
    .replace(/\s+/g, ' ')
}

export function IndexedSessionRenameDialog({
  session,
  onClose,
}: {
  session: SessionListItem | null
  onClose: () => void
}) {
  const { t } = useTranslation('sessions')
  const queryClient = useQueryClient()
  const [name, setName] = useState(
    session?.argoTitle ?? session?.vendorTitle ?? session?.firstPrompt ?? session?.nativeId ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  async function save() {
    if (session === null || saving) return
    const title = normalizeSessionName(name)
    if (title.length === 0) {
      setError(t('rename.enterName'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await trpcClient.sessions.rename.mutate({ argoId: session.argoId, title })
      await queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rename.failure'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
      open={session !== null}
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
          <Label htmlFor="indexed-session-name">{t('rename.name')}</Label>
          <Input
            aria-invalid={error !== null}
            autoFocus
            disabled={saving}
            id="indexed-session-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          {error === null ? null : (
            <p className="type-body text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button disabled={saving} onClick={onClose} type="button" variant="outline">
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

export function useIndexedRename() {
  const [session, setSession] = useState<SessionListItem | null>(null)
  const [key, setKey] = useState(0)
  return {
    session,
    key,
    open: (target: SessionListItem) => {
      setSession(target)
      setKey((current) => current + 1)
    },
    close: () => setSession(null),
  }
}
