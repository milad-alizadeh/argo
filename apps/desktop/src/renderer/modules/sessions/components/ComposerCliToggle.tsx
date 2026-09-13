import { type KeyboardEvent, useCallback } from 'react'

import { Button } from '../../../components/ui/button'
import type { SessionCli } from '../hooks/useSessionComposer'

const CLI_OPTIONS = ['claude', 'codex'] as const

function nextCliOption(key: string, index: number): (typeof CLI_OPTIONS)[number] | undefined {
  const last = CLI_OPTIONS.length - 1
  const stepsByKey: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
  if (key === 'Home') return CLI_OPTIONS[0]
  if (key === 'End') return CLI_OPTIONS[last]
  const step = stepsByKey[key]
  return step === undefined
    ? undefined
    : CLI_OPTIONS[(index + step + CLI_OPTIONS.length) % CLI_OPTIONS.length]
}

// Shown only for a brand-new Session, before one exists to observe a CLI from; the harness tabs
// of the full picker are #1885, and Model, Effort and Mode sit in the composer's own bar.
export function ComposerCliToggle({
  cli,
  onChangeCli,
}: {
  cli: SessionCli
  onChangeCli: (cli: SessionCli) => void
}) {
  // WAI-ARIA APG radiogroup: only the checked option is tabbable, and Left/Right/Home/End move
  // both selection and focus among the options.
  const moveSelection = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const next = nextCliOption(event.key, CLI_OPTIONS.indexOf(cli))
      if (next === undefined) return
      event.preventDefault()
      // Programmatic focus does not require the target's tabIndex to already be 0, so this can
      // run synchronously instead of waiting a frame for the re-render that flips it.
      event.currentTarget.parentElement
        ?.querySelector<HTMLButtonElement>(`[data-cli-option="${next}"]`)
        ?.focus()
      onChangeCli(next)
    },
    [cli, onChangeCli],
  )

  return (
    <div className="flex items-center gap-1 pt-2" role="radiogroup" aria-label="Choose CLI">
      {CLI_OPTIONS.map((option) => (
        <Button
          key={option}
          data-cli-option={option}
          type="button"
          role="radio"
          aria-checked={cli === option}
          tabIndex={cli === option ? 0 : -1}
          variant={cli === option ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onChangeCli(option)}
          onKeyDown={moveSelection}
        >
          {option === 'claude' ? 'Claude Code' : 'Codex'}
        </Button>
      ))}
    </div>
  )
}
