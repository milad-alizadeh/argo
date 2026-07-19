import { cn } from '@/lib/utils'
import { STATUS_TONE, type StatusTone } from './sessionStatus'

// Atom: the lifecycle word that sits beside a StatusDot or at the end of a row. The word
// is what carries the state — the tone only tints it.
export function StatusWord({
  word,
  tone,
  className,
}: {
  word: string
  tone: StatusTone
  className?: string
}): React.JSX.Element {
  return (
    <span className={cn('shrink-0 text-meta', STATUS_TONE[tone].textClass, className)}>{word}</span>
  )
}
