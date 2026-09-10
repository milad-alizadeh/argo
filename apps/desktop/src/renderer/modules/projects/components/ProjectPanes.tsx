// The three Project panes of the deck, in the measurements the design ticket froze (#1896).
import type { ReactNode } from 'react'
import type { ProjectSummary } from '../../../../core/projects/messages'
import { Button } from '../../../components/ui/button'
import { ProjectRefusal } from './ProjectRefusal'

export const TITLE = 'text-title font-semibold'
export const LINE = 'text-body text-muted-foreground'

function Spacer() {
  return <div className="h-2" aria-hidden="true" />
}

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
      className="px-3 text-body"
    >
      {children}
    </Button>
  )
}

export function EmptyPane({
  message,
  busy,
  onOpen,
}: {
  message: string | null
  busy: boolean
  onOpen: () => void
}) {
  return (
    <>
      <h1 className={TITLE}>No Project open</h1>
      {message ? (
        <ProjectRefusal message={message} />
      ) : (
        <p className={LINE}>Argo works inside one registered git repository at a time.</p>
      )}
      <Spacer />
      <DeckButton onClick={onOpen} disabled={busy}>
        Open Project…
      </DeckButton>
    </>
  )
}

// A Project is open. A folder the last action turned away is shown here rather than dropped: the
// refusal is the only thing on screen that says the chooser was answered at all.
export function SelectedPane({
  project,
  message,
  actions,
}: {
  project: ProjectSummary
  message: string | null
  actions: { busy: boolean; onOpen: () => void }
}) {
  return (
    <>
      <h1 className={TITLE}>{project.name}</h1>
      <p className={LINE}>{project.path}</p>
      {message ? <ProjectRefusal message={message} /> : null}
      <Spacer />
      <DeckButton onClick={actions.onOpen} disabled={actions.busy} outline>
        Open another Project…
      </DeckButton>
    </>
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
    <>
      <h1 className={TITLE}>{project.name}</h1>
      <ProjectRefusal message={message}>
        <DeckButton onClick={onOpen} disabled={busy} outline>
          Locate Project…
        </DeckButton>
      </ProjectRefusal>
    </>
  )
}
