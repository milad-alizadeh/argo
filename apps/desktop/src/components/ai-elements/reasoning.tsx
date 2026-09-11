import { BrainIcon, ChevronDownIcon } from 'lucide-react'
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/renderer/components/ui/collapsible'
import { cn } from '@/renderer/lib/utils'

type ReasoningContextValue = {
  duration?: number
  isOpen: boolean
  isStreaming: boolean
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

function useReasoning() {
  const context = useContext(ReasoningContext)
  if (!context) throw new Error('Reasoning components must be used within Reasoning')
  return context
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  duration?: number
  isStreaming?: boolean
}

export function Reasoning({
  children,
  className,
  defaultOpen = false,
  duration,
  isStreaming = false,
  onOpenChange,
  open,
  ...props
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen || isStreaming)
  const isOpen = open ?? internalOpen
  useEffect(() => {
    if (isStreaming) setInternalOpen(true)
  }, [isStreaming])
  const changeOpen: NonNullable<ReasoningProps['onOpenChange']> = (nextOpen, eventDetails) => {
    setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen, eventDetails)
  }
  return (
    <ReasoningContext.Provider value={{ duration, isOpen, isStreaming }}>
      <Collapsible
        className={cn('not-prose mb-4', className)}
        open={isOpen}
        onOpenChange={changeOpen}
        {...props}
      >
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  )
}

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ReactNode
}

export function ReasoningTrigger({
  children,
  className,
  getThinkingMessage = (isStreaming, duration) =>
    isStreaming ? 'Thinking…' : `Thought for ${duration ?? 'a few'} seconds`,
  ...props
}: ReasoningTriggerProps) {
  const { duration, isOpen, isStreaming } = useReasoning()
  return (
    <CollapsibleTrigger
      className={cn(
        'flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <BrainIcon className="size-4" />
          {getThinkingMessage(isStreaming, duration)}
          <ChevronDownIcon
            className={cn('size-4 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
          />
        </>
      )}
    </CollapsibleTrigger>
  )
}

export type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string
}

export function ReasoningContent({ children, className, ...props }: ReasoningContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        'mt-4 text-sm text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
        className,
      )}
      {...props}
    >
      {children}
    </CollapsibleContent>
  )
}
