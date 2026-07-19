import { cn } from '@/lib/utils'

// Atom: a value the cockpit estimated rather than counted (parsed stdout, snapshot diff,
// token-sum estimate) — dotted underline, with `title` carrying the provenance. Exact
// counts render plain, never through this. `gone` = the tool ran but its output was not
// captured, so there is no value to underline.
export function DerivedValue({
  text,
  title,
  gone = false,
  className,
}: {
  text: string
  title: string
  gone?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        'cursor-help underline decoration-dotted decoration-foreground-faint decoration-from-font underline-offset-2',
        gone && 'text-foreground-faint no-underline',
        className,
      )}
    >
      {text}
    </span>
  )
}
