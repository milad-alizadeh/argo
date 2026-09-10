// Three Argo composer directions, switchable with ?variant=A, on the existing cockpit (#1258).
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleGauge,
  Command,
  File,
  Folder,
  Gauge,
  Hexagon,
  Mic,
  Paperclip,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/renderer/components/ui/attachment'
import { Badge } from '@/renderer/components/ui/badge'
import { Bubble, BubbleContent } from '@/renderer/components/ui/bubble'
import { Button } from '@/renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/renderer/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  InputGroupText,
} from '@/renderer/components/ui/input-group'
import { Marker, MarkerContent, MarkerIcon } from '@/renderer/components/ui/marker'
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from '@/renderer/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/renderer/components/ui/message-scroller'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/renderer/components/ui/popover'
import { Progress } from '@/renderer/components/ui/progress'
import { Separator } from '@/renderer/components/ui/separator'

type HarnessKey = 'codex' | 'claude'
type VariantKey = 'A' | 'B' | 'C'
type MessageRow = { id: string; role: 'user' | 'assistant' | 'marker'; text: string }

type HarnessDefinition = {
  label: string
  models: string[]
  efforts: string[]
  permissions: { label: string; detail: string }[]
  context: { used: number; total: number }
  usage: { label: string; detail: string; percentage: number }[]
}

type ComposerState = {
  harness: HarnessKey
  model: string
  effort: string
  permission: string
  attachments: string[]
}

type StateProps = {
  state: ComposerState
  setState: (state: ComposerState) => void
}

const HARNESSES: Record<HarnessKey, HarnessDefinition> = {
  codex: {
    label: 'Codex',
    models: ['GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna'],
    efforts: ['Low', 'Medium', 'High', 'Extra high'],
    permissions: [
      { label: 'Ask first', detail: 'Confirm external access and file changes' },
      { label: 'Approve safely', detail: 'Pause only when an action looks unsafe' },
      { label: 'Full access', detail: 'Work without permission prompts' },
    ],
    context: { used: 148_000, total: 200_000 },
    usage: [
      { label: 'Weekly', detail: 'Resets Monday at 9:00 AM', percentage: 54 },
      { label: 'Monthly', detail: 'Resets October 1', percentage: 31 },
    ],
  },
  claude: {
    label: 'Claude Code',
    models: ['Opus 5', 'Sonnet 5', 'Haiku 4.5'],
    efforts: ['Low', 'Medium', 'High'],
    permissions: [
      { label: 'Auto', detail: 'Claude handles permission decisions' },
      { label: 'Manual', detail: 'Ask before making changes' },
      { label: 'Accept edits', detail: 'Accept file edits automatically' },
      { label: 'Plan', detail: 'Create a plan before making changes' },
      { label: 'Bypass', detail: 'Run without permission checks' },
    ],
    context: { used: 121_000, total: 200_000 },
    usage: [
      { label: '5-hour limit', detail: 'Resets in 4 hr 5 min', percentage: 8 },
      { label: 'Weekly, all models', detail: 'Resets Saturday at 6:00 PM', percentage: 65 },
      { label: 'Weekly, Opus', detail: 'Resets Saturday at 6:00 PM', percentage: 12 },
    ],
  },
}

const VARIANTS: Record<VariantKey, string> = {
  A: 'Context rail',
  B: 'Control ledger',
  C: 'Split instrument',
}

const INITIAL_MESSAGES: MessageRow[] = [
  {
    id: 'turn-1',
    role: 'user',
    text: 'Find the seam between the session transcript and the command composer.',
  },
  {
    id: 'turn-2',
    role: 'assistant',
    text: 'The seam is context. The composer needs to show what the next instruction will cost, which harness will run it, and when this task needs a clean handoff.',
  },
  {
    id: 'checkpoint',
    role: 'marker',
    text: 'Composer prototype · context at 74%',
  },
  {
    id: 'turn-3',
    role: 'assistant',
    text: 'I have separated writing from orchestration. The input stays calm; the context rail and run controls explain the execution environment without competing with the message.',
  },
]

function HarnessIcon({ harness, className }: { harness: HarnessKey; className?: string }) {
  return harness === 'codex' ? <Hexagon className={className} /> : <Sparkles className={className} />
}

function contextPercentage(state: ComposerState) {
  const context = HARNESSES[state.harness].context
  return Math.round((context.used / context.total) * 100)
}

function selectHarness(state: ComposerState, harness: HarnessKey): ComposerState {
  const definition = HARNESSES[harness]
  return {
    ...state,
    harness,
    model: definition.models[0] ?? '',
    effort: definition.efforts[1] ?? definition.efforts[0] ?? '',
    permission: definition.permissions[0]?.label ?? '',
  }
}

function SelectionMark({ active }: { active: boolean }) {
  return <span className="ml-auto w-4">{active ? <Check className="size-4" /> : null}</span>
}

function AddContextMenu({ state, setState }: StateProps) {
  const add = (reference: string) => {
    if (state.attachments.includes(reference)) return
    setState({ ...state, attachments: [...state.attachments, reference] })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton size="icon-sm" variant="ghost" aria-label="Add context" />}
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Add context</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => add('composer-study.png')}>
            <Paperclip />Attachment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => add('ComposerPrototype.tsx')}>
            <File />File reference
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => add('apps/desktop')}>
            <Folder />Folder reference
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => add('$frontend-design')}>
          <WandSparkles />Skill
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => add('/prototype')}>
          <Command />Command
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HarnessItems({ state, setState }: StateProps) {
  return (
    <>
      {(Object.keys(HARNESSES) as HarnessKey[]).map((harness) => (
        <DropdownMenuItem key={harness} onClick={() => setState(selectHarness(state, harness))}>
          <HarnessIcon harness={harness} />
          {HARNESSES[harness].label}
          <SelectionMark active={state.harness === harness} />
        </DropdownMenuItem>
      ))}
    </>
  )
}

function RunMenu({ state, setState, label = 'Run setup' }: StateProps & { label?: string }) {
  const definition = HARNESSES[state.harness]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton variant="ghost" className="max-w-64" aria-label="Choose run setup" />}
      >
        <HarnessIcon harness={state.harness} />
        <span className="truncate">{label === 'Run setup' ? state.model : label}</span>
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Run setup</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HarnessIcon harness={state.harness} />
              Harness
              <span className="ml-auto text-muted-foreground">{definition.label}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              <HarnessItems state={state} setState={setState} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Bot />
              Model
              <span className="ml-auto text-muted-foreground">{state.model}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {definition.models.map((model) => (
                <DropdownMenuItem key={model} onClick={() => setState({ ...state, model })}>
                  {model}<SelectionMark active={state.model === model} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BrainCircuit />
              Effort
              <span className="ml-auto text-muted-foreground">{state.effort}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {definition.efforts.map((effort) => (
                <DropdownMenuItem key={effort} onClick={() => setState({ ...state, effort })}>
                  {effort}<SelectionMark active={state.effort === effort} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ShieldCheck />
            Permission
            <span className="ml-auto text-muted-foreground">{state.permission}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{definition.label}</DropdownMenuLabel>
              {definition.permissions.map((permission) => (
                <DropdownMenuItem
                  key={permission.label}
                  className="items-start py-2"
                  onClick={() => setState({ ...state, permission: permission.label })}
                >
                  <ShieldCheck className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span>{permission.label}</span>
                    <span className="text-xs text-muted-foreground">{permission.detail}</span>
                  </span>
                  <SelectionMark active={state.permission === permission.label} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ReferenceStrip({ state, setState }: StateProps) {
  if (state.attachments.length === 0) return null
  return (
    <AttachmentGroup className="w-full px-3 pt-3">
      {state.attachments.map((reference) => (
        <Attachment key={reference} size="xs">
          <AttachmentMedia><File /></AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{reference}</AttachmentTitle>
            <AttachmentDescription>Task context</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction
              aria-label={`Remove ${reference}`}
              onClick={() =>
                setState({
                  ...state,
                  attachments: state.attachments.filter((item) => item !== reference),
                })
              }
            >
              <X />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}

function ContextActions() {
  return (
    <div className="flex gap-1">
      <Button variant="outline" size="sm"><RotateCcw />Compact</Button>
      <Button variant="secondary" size="sm"><ArrowRight />Handoff</Button>
    </div>
  )
}

function UsagePanel({ state }: { state: ComposerState }) {
  const definition = HARNESSES[state.harness]
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{definition.label} usage</p>
          <p className="text-xs text-muted-foreground">Reported by the active harness</p>
        </div>
      </div>
      {definition.usage.map((item) => (
        <div key={item.label} className="grid gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm">{item.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>
            <span className="w-8 text-right text-xs tabular-nums">{item.percentage}%</span>
          </div>
          <Progress value={item.percentage} />
        </div>
      ))}
    </div>
  )
}

function CapacityPopover({ state, compact = false }: { state: ComposerState; compact?: boolean }) {
  const definition = HARNESSES[state.harness]
  const percentage = contextPercentage(state)
  return (
    <Popover>
      <PopoverTrigger
        render={
          <InputGroupButton
            variant={percentage >= 70 ? 'secondary' : 'ghost'}
            aria-label="View context and usage"
          />
        }
      >
        <CircleGauge />
        <span>{compact ? `${percentage}%` : `${definition.context.used / 1000}k of ${definition.context.total / 1000}k`}</span>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Task capacity</PopoverTitle>
          <PopoverDescription>
            {definition.context.used / 1000}k of {definition.context.total / 1000}k tokens used
          </PopoverDescription>
        </PopoverHeader>
        <Progress value={percentage} />
        {percentage >= 70 && (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Make room before the next large change.</p>
            <ContextActions />
          </div>
        )}
        <Separator />
        <UsagePanel state={state} />
      </PopoverContent>
    </Popover>
  )
}

function TranscriptRow({ message }: { message: MessageRow }) {
  if (message.role === 'marker') {
    return (
      <Marker variant="separator">
        <MarkerIcon><CircleGauge /></MarkerIcon>
        <MarkerContent>{message.text}</MarkerContent>
      </Marker>
    )
  }
  const isUser = message.role === 'user'
  return (
    <Message align={isUser ? 'end' : 'start'}>
      <MessageContent>
        <MessageHeader>{isUser ? 'You' : 'Argo'}</MessageHeader>
        <Bubble variant={isUser ? 'secondary' : 'ghost'} align={isUser ? 'end' : 'start'}>
          <BubbleContent>{message.text}</BubbleContent>
        </Bubble>
        {!isUser && <MessageFooter>Read from Session · now</MessageFooter>}
      </MessageContent>
    </Message>
  )
}

function Transcript({ messages }: { messages: MessageRow[] }) {
  return (
    <MessageScrollerProvider defaultScrollPosition="end">
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-3xl px-8 py-10">
            {messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={message.role === 'user'}
              >
                <TranscriptRow message={message} />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

type ComposerProps = StateProps & {
  draft: string
  setDraft: (draft: string) => void
  isListening: boolean
  setIsListening: (listening: boolean) => void
  send: () => void
}

function MessageBox({
  state,
  setState,
  draft,
  setDraft,
  isListening,
  setIsListening,
  send,
  children,
  className = '',
}: ComposerProps & { children?: React.ReactNode; className?: string }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
      className={className}
    >
      <InputGroup className="overflow-hidden rounded-xl bg-background shadow-lg shadow-foreground/5">
        <ReferenceStrip state={state} setState={setState} />
        <InputGroupTextarea
          aria-label="Message"
          placeholder="Direct the next move…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-24 px-4 py-3 text-sm leading-6"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
        />
        {children}
        <InputGroupAddon align="block-end" className="gap-1 border-t bg-muted/30 px-2.5 py-2">
          <AddContextMenu state={state} setState={setState} />
          <RunMenu state={state} setState={setState} />
          <InputGroupText className="hidden text-xs lg:flex">
            <ShieldCheck className="size-3.5" />{state.permission}
          </InputGroupText>
          <div className="ml-auto flex items-center gap-1">
            <CapacityPopover state={state} compact />
            <InputGroupButton
              size="icon-sm"
              variant={isListening ? 'secondary' : 'ghost'}
              aria-label={isListening ? 'Stop listening' : 'Use microphone'}
              onClick={() => setIsListening(!isListening)}
            >
              <Mic />
            </InputGroupButton>
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              aria-label="Send message"
              disabled={draft.trim().length === 0}
              className="rounded-full"
            >
              <ArrowUp />
            </InputGroupButton>
          </div>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

function ContextRail({ state }: { state: ComposerState }) {
  const definition = HARNESSES[state.harness]
  const percentage = contextPercentage(state)
  return (
    <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-1">
      <span className="text-xs font-medium">Context</span>
      <div className="relative">
        <Progress value={percentage} className="[&_[data-slot=progress-track]]:h-1.5" />
        <span className="absolute top-1/2 left-3/4 h-3 w-px -translate-y-1/2 bg-background" />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {definition.context.used / 1000}k / {definition.context.total / 1000}k
      </span>
    </div>
  )
}

function VariantA(props: ComposerProps) {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-2 px-8 pb-20">
      <ContextRail state={props.state} />
      <MessageBox {...props} />
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          Compact becomes available at 70%. Handoff becomes recommended at 90%.
        </span>
        {contextPercentage(props.state) >= 70 && <ContextActions />}
      </div>
    </div>
  )
}

function LedgerCell({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Bot }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-2 border-r px-3 last:border-r-0">
      <Icon className="row-span-2 size-4 text-muted-foreground" />
      <span className="truncate text-sm font-medium">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function VariantB(props: ComposerProps) {
  const definition = HARNESSES[props.state.harness]
  return (
    <div className="mx-auto w-full max-w-5xl px-8 pb-20">
      <div className="overflow-hidden rounded-xl border bg-background shadow-lg shadow-foreground/5">
        <div className="grid grid-cols-2 border-b bg-muted/30 sm:grid-cols-4">
          <LedgerCell label="Harness" value={definition.label} icon={Hexagon} />
          <LedgerCell label="Model" value={props.state.model} icon={Bot} />
          <LedgerCell label="Effort" value={props.state.effort} icon={BrainCircuit} />
          <LedgerCell label="Permission" value={props.state.permission} icon={ShieldCheck} />
        </div>
        <MessageBox {...props} className="[&_[data-slot=input-group]]:rounded-none [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:shadow-none">
          <div className="px-3 pb-2">
            <ContextRail state={props.state} />
          </div>
        </MessageBox>
      </div>
    </div>
  )
}

function VariantC(props: ComposerProps) {
  const definition = HARNESSES[props.state.harness]
  const percentage = contextPercentage(props.state)
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-2 px-8 pb-20 md:grid-cols-[1fr_15rem]">
      <MessageBox {...props} />
      <aside className="flex flex-col rounded-xl border bg-background p-3 shadow-lg shadow-foreground/5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium">{definition.label}</p>
            <p className="text-xs text-muted-foreground">{props.state.model}</p>
          </div>
          <HarnessIcon harness={props.state.harness} className="size-5" />
        </div>
        <div className="grid gap-1">
          <span className="text-lg font-medium tabular-nums">{percentage}%</span>
          <span className="text-xs text-muted-foreground">Context occupied</span>
          <Progress value={percentage} className="mt-1" />
        </div>
        <Separator className="my-4" />
        <div className="grid gap-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Effort</span><span>{props.state.effort}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Permission</span><span>{props.state.permission}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">References</span><span>{props.state.attachments.length}</span></div>
        </div>
        <div className="mt-auto pt-4">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" size="sm" className="w-full" />}>
              <Gauge />Usage
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-96 p-4">
              <UsagePanel state={props.state} />
            </PopoverContent>
          </Popover>
        </div>
      </aside>
    </div>
  )
}

function PrototypeSwitcher({
  variant,
  changeVariant,
}: {
  variant: VariantKey
  changeVariant: (variant: VariantKey) => void
}) {
  const keys: VariantKey[] = ['A', 'B', 'C']
  const move = (direction: number) => {
    const index = keys.indexOf(variant)
    changeVariant(keys[(index + direction + keys.length) % keys.length] ?? 'A')
  }
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground p-1 text-background shadow-xl">
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-background hover:bg-background/15 hover:text-background"
        aria-label="Previous variant"
        onClick={() => move(-1)}
      >
        <ArrowLeft />
      </Button>
      <span className="min-w-40 px-2 text-center text-xs font-medium">{variant} · {VARIANTS[variant]}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-background hover:bg-background/15 hover:text-background"
        aria-label="Next variant"
        onClick={() => move(1)}
      >
        <ArrowRight />
      </Button>
    </div>
  )
}

function variantFromURL(): VariantKey {
  const value = new URLSearchParams(window.location.search).get('variant')
  return value === 'B' || value === 'C' ? value : 'A'
}

export function ComposerPrototype() {
  const [variant, setVariant] = useState<VariantKey>(variantFromURL)
  const [state, setState] = useState<ComposerState>({
    harness: 'codex',
    model: HARNESSES.codex.models[0] ?? '',
    effort: HARNESSES.codex.efforts[1] ?? '',
    permission: HARNESSES.codex.permissions[2]?.label ?? '',
    attachments: ['$frontend-design'],
  })
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [draft, setDraft] = useState('')
  const [isListening, setIsListening] = useState(false)

  const changeVariant = useCallback((next: VariantKey) => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState(null, '', url)
    setVariant(next)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const keys: VariantKey[] = ['A', 'B', 'C']
      const index = keys.indexOf(variant)
      const direction = event.key === 'ArrowRight' ? 1 : -1
      changeVariant(keys[(index + direction + keys.length) % keys.length] ?? 'A')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changeVariant, variant])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages([
      ...messages,
      { id: `turn-${messages.length + 1}`, role: 'user', text },
      {
        id: `turn-${messages.length + 2}`,
        role: 'assistant',
        text: 'The prototype received this instruction. In the product, the selected harness would begin the run here.',
      },
    ])
    setDraft('')
  }

  const composerProps: ComposerProps = {
    state,
    setState,
    draft,
    setDraft,
    isListening,
    setIsListening,
    send,
  }

  return (
    <main
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
      data-prototype="composer"
      data-variant={variant}
    >
      <header className="flex h-12 shrink-0 items-center border-b px-5">
        <div>
          <h1 className="text-lg font-medium">Composer study</h1>
          <p className="text-xs text-muted-foreground">Harness-aware task control</p>
        </div>
        <Badge variant="outline" className="ml-auto">
          <HarnessIcon harness={state.harness} />{HARNESSES[state.harness].label}
        </Badge>
      </header>
      <div className="min-h-0 flex-1">
        <Transcript messages={messages} />
      </div>
      <div className="relative shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-8">
        {variant === 'A' && <VariantA {...composerProps} />}
        {variant === 'B' && <VariantB {...composerProps} />}
        {variant === 'C' && <VariantC {...composerProps} />}
      </div>
      <PrototypeSwitcher variant={variant} changeVariant={changeVariant} />
    </main>
  )
}
