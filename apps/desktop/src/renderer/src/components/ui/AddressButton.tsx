import { cva } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'
import { CONTROL_BASE } from './button'
import type { FindingState } from './findingState'
import {
  ArrowBendDownRightIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  type IconAtom,
} from './icons'
import { Text } from './Text'

// What the control does next, not where the finding is: the state is already reported by
// the StateChip beside it, so this label is always the action.
const STATE_ACTION: Record<FindingState, { label: string; title: string; Icon: IconAtom }> = {
  open: {
    label: 'Address',
    title: "dispatch code-review's fix agent",
    Icon: ArrowBendDownRightIcon,
  },
  addressing: {
    label: 'Mark fixed',
    title: 'mark the dispatched fix confirmed',
    Icon: CheckIcon,
  },
  fixed: {
    label: 'Reopen',
    title: 'reopen this finding',
    Icon: ArrowCounterClockwiseIcon,
  },
}

// Tones follow the state the finding is IN (amber while open, green once the fix is
// dispatched, quiet once fixed) — the same verdict tint pairs the StateChip wears.
const addressButtonVariants = cva(CONTROL_BASE, {
  variants: {
    state: {
      open: 'border-verdict-changes-tint/55 bg-verdict-changes-tint/12 text-foreground hover:border-verdict-changes-tint hover:bg-verdict-changes-tint/24',
      addressing:
        'border-verdict-approve-tint/55 bg-verdict-approve-tint/12 text-foreground hover:border-verdict-approve-tint hover:bg-verdict-approve-tint/24',
      fixed:
        'border-border bg-transparent text-muted-foreground hover:border-input hover:bg-foreground/4 hover:text-foreground',
    },
    // Each size states the whole box — see CONTROL_BASE on why padding can't be inherited
    // and overridden.
    size: {
      default: 'px-inset py-snug',
      // The inline FindingCard wedges this under a diff hunk, where the control has to
      // give the code back its room.
      sm: 'px-gap py-tight',
    },
  },
})

type AddressButtonProps = Omit<React.ComponentProps<'button'>, 'children'> & {
  /** Where the finding stands. The button shows what happens next — Address, Mark fixed,
   * Reopen — so a caller passes the state, never the verb. */
  state: FindingState
  /** `sm` is the tighter box the inline FindingCard uses; the Review-tab row takes the
   * default. */
  size?: 'default' | 'sm'
}

// Atom: the one control that advances a review finding through open → addressing → fixed
// (and back). It carries the whole cycle so no call site spells the verbs itself.
export function AddressButton({
  state,
  size = 'default',
  className,
  onClick,
  ...props
}: AddressButtonProps): React.JSX.Element {
  const { label, title, Icon } = STATE_ACTION[state]

  // Both homes of a finding — the Review-tab row and the inline card — are themselves
  // clickable (they route to the diff), so the control stops the click here rather than
  // asking every call site to remember.
  function handleClick(event: React.MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation()
    onClick?.(event)
  }

  return (
    <button
      type="button"
      data-slot="address-button"
      data-state={state}
      title={title}
      className={cn(addressButtonVariants({ state, size }), className)}
      onClick={handleClick}
      {...props}
    >
      <Icon aria-hidden />
      <Text variant="row-strong">{label}</Text>
    </button>
  )
}
