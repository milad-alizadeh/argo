// The Project panes of the deck, in the measurements the design ticket froze (#1896). A Project is
// the window's subject rather than a surface, so these two panes are the gate the cockpit stands
// behind: until a Project is open, they are the only thing on screen.
import { FolderIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProjectSummary } from '@/core/projects/messages'
import { Button } from '../../../components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { ProjectRefusal } from './ProjectRefusal'

export const TITLE = 'text-title font-semibold'
export const LINE = 'text-body text-muted-foreground'

function DeckButton({
  onClick,
  disabled,
  outline,
  children,
}: {
  onClick: () => void
  disabled: boolean
  outline?: boolean
  children: ReactNode
}) {
  return (
    <Button
      variant={outline ? 'outline' : 'default'}
      onClick={onClick}
      disabled={disabled}
      className="px-3"
    >
      {/* A plain className, never one merged through Button's cn(): cn's tailwind-merge table
          groups the custom `--text-body` token with Tailwind's text-color utilities by name
          alone, and silently drops whichever the caller passed (#1907). */}
      <span className="text-body">{children}</span>
    </Button>
  )
}

// `EmptyContent` is capped at `max-w-sm` for a stack of controls, and the refusal is a row: its
// message and its action sit side by side, so it takes the deck's own width instead.
function Refusal({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[var(--size-deck)] text-left">{children}</div>
}

export function EmptyPane({
  message,
  busy,
  onImport,
  onOpen,
}: {
  message: string | null
  busy: boolean
  onImport: () => void
  onOpen: () => void
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderIcon />
        </EmptyMedia>
        <EmptyTitle>No Project open</EmptyTitle>
        <EmptyDescription>
          Argo works inside one registered git repository at a time.
        </EmptyDescription>
      </EmptyHeader>
      {message ? <ProjectRefusal message={message} /> : null}
      <EmptyContent>
        <DeckButton onClick={onOpen} disabled={busy}>
          Open Project…
        </DeckButton>
        <DeckButton onClick={onImport} disabled={busy} outline>
          Import existing Projects
        </DeckButton>
      </EmptyContent>
    </Empty>
  )
}

// A refusal keeps the Project on screen: the identity survives the folder, and relocation is the
// action that gives it a new path without minting a second one.
export function RefusedPane({
  project,
  message,
  busy,
  onOpen,
}: {
  project: ProjectSummary
  message: string
  busy: boolean
  onOpen: () => void
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderIcon />
        </EmptyMedia>
        <EmptyTitle>{project.name}</EmptyTitle>
        <EmptyDescription>{project.path}</EmptyDescription>
      </EmptyHeader>
      <Refusal>
        <ProjectRefusal message={message}>
          <DeckButton onClick={onOpen} disabled={busy} outline>
            Locate Project…
          </DeckButton>
        </ProjectRefusal>
      </Refusal>
    </Empty>
  )
}
