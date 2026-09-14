// One background Shell's live output, in the Terminal the rest of the app reads command output
// through (#1582). The pane states the command's own words and its current state, so a reader
// who left the rail behind still knows which command they are watching.
import { ArrowLeft } from 'lucide-react'
import {
  Terminal,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@/components/ai-elements/terminal'
import type { SessionShellCommand } from '@/core/sessions/models'
import { Button } from '@/renderer/components/ui/button'
import { SHELL_STATE_WORDS, workDuration } from './session-work'

export function SessionShellInspector({
  command,
  output,
  onBack,
  now,
}: {
  command: SessionShellCommand
  // What the recorded output source holds, or null where the Shell recorded none. An empty
  // string is a source that exists and has written nothing yet, which is not the same thing.
  output: string | null
  onBack: () => void
  now?: number
}) {
  const title = command.command ?? command.id
  const duration = workDuration(command.startedAt, command.endedAt, now ?? Date.now())
  return (
    <section aria-label="Background Shell" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center gap-2 border-b border-border/60 bg-sidebar px-3">
        <Button variant="ghost" size="sm" className="justify-start p-0 type-label" onClick={onBack}>
          <ArrowLeft />
          Back
        </Button>
      </header>
      <div className="shrink-0 px-4 py-3">
        <p className="truncate font-mono type-meta text-foreground">{title}</p>
        <p className="type-meta text-muted-foreground">
          {[SHELL_STATE_WORDS[command.state], duration, command.result]
            .filter((fact) => fact !== null)
            .join(' · ')}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {output === null ? (
          <p className="type-meta text-muted-foreground">This command recorded no output.</p>
        ) : (
          <Terminal output={output} isStreaming={command.state === 'running'}>
            <TerminalHeader>
              <TerminalTitle className="type-meta">{title}</TerminalTitle>
              <TerminalCopyButton />
            </TerminalHeader>
            <TerminalContent className="type-code" />
          </Terminal>
        )}
      </div>
    </section>
  )
}
