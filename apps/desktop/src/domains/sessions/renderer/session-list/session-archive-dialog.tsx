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
import type { SessionId } from '../types'

export type HeldWorktree = RouterOutputs['sessionWorktreeWork']['worktrees'][number]

// The archive waiting on the person: `worktrees` is null when Argo could not check them at all.
export type ArchiveQuestion = { sessionIds: SessionId[]; worktrees: HeldWorktree[] | null }

function worktreeName(worktree: HeldWorktree) {
  return worktree.branch ?? worktree.path.split('/').at(-1) ?? worktree.path
}

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
      <span className="font-medium">{worktreeName(worktree)}</span>
      <span className="text-muted-foreground">
        {' · '}
        {changed}
        {' · '}
        {commits}
      </span>
    </li>
  )
}

// Asks before an archive removes worktree work, as Claude Code does on exit.
export function SessionArchiveDialog({
  question,
  onAnswer,
}: {
  question: ArchiveQuestion | null
  onAnswer: (answer: 'keep' | 'remove' | 'cancel') => void
}) {
  const { t } = useTranslation('sessions')
  const worktrees = question?.worktrees ?? null
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
            {t('archiveWorktree.title', { count: worktrees?.length ?? 1 })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {worktrees === null ? t('archiveWorktree.unchecked') : t('archiveWorktree.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {worktrees !== null ? (
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
