import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/platform/renderer/components/ui/alert-dialog'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'
import { parseFilename } from '../attachment-chip'
import type { SessionId } from '../types'

export type HeldWorktree = RouterOutputs['sessionWorktreeWork']['worktrees'][number]

// Unchecked when main could not read the worktrees; each is then named with its work unknown.
export type ArchiveQuestion = {
  sessionIds: SessionId[]
  worktrees: HeldWorktree[]
  checked: boolean
}

export type ArchiveAnswer = 'keep' | 'remove' | 'cancel'

function WorktreeWork({ worktree }: { worktree: HeldWorktree }) {
  const { t } = useTranslation('sessions')
  const changed =
    worktree.changedFiles === null
      ? t('archiveWorktree.changedFilesUnchecked')
      : t('archiveWorktree.changedFiles', { count: worktree.changedFiles })
  const commits =
    worktree.ownCommits === null
      ? t('archiveWorktree.ownCommitsUnchecked')
      : t('archiveWorktree.ownCommits', { count: worktree.ownCommits })
  return (
    <li className="min-w-0" title={worktree.path}>
      <span className="font-medium">{worktree.branch ?? parseFilename(worktree.path).name}</span>
      <span className="text-muted-foreground">
        {' · '}
        {changed}
        {' · '}
        {commits}
      </span>
    </li>
  )
}

// Asks before an archive removes worktree work.
export function SessionArchiveDialog({
  question,
  onAnswer,
}: {
  question: ArchiveQuestion | null
  onAnswer: (answer: ArchiveAnswer) => void
}) {
  const { t } = useTranslation('sessions')
  const worktrees = question?.worktrees ?? []
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) onAnswer('cancel')
      }}
      open={question !== null}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('archiveWorktree.title', { count: Math.max(worktrees.length, 1) })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {question?.checked === false
              ? t('archiveWorktree.unchecked')
              : t('archiveWorktree.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {worktrees.length > 0 ? (
          <ul className="grid gap-1 type-meta">
            {worktrees.map((worktree) => (
              <WorktreeWork key={worktree.sessionId} worktree={worktree} />
            ))}
          </ul>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('archiveWorktree.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onAnswer('keep')} variant="outline">
            {t('archiveWorktree.keep')}
          </AlertDialogAction>
          <AlertDialogAction onClick={() => onAnswer('remove')} variant="destructive">
            {t('archiveWorktree.remove')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
