// One composer direction after the blind UX and visual reviews selected the single-surface layout.
import {
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
  Mic,
  Paperclip,
  Plus,
  RotateCcw,
  ShieldCheck,
  WandSparkles,
  X,
} from 'lucide-react'
import { useState } from 'react'
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
} from '@/renderer/components/ui/input-group'
import { Marker, MarkerContent } from '@/renderer/components/ui/marker'
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

type HarnessKey = 'codex' | 'claude'
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

const INITIAL_MESSAGES: MessageRow[] = [
  {
    id: 'turn-1',
    role: 'user',
    text: 'Find the seam between the session transcript and the command composer.',
  },
  {
    id: 'turn-2',
    role: 'assistant',
    text: 'The composer now treats execution setup, context capacity, and account usage as separate decisions. Each has one stable home.',
  },
  {
    id: 'checkpoint',
    role: 'marker',
    text: 'Run setup changed to Codex',
  },
  {
    id: 'turn-3',
    role: 'assistant',
    text: 'The next instruction will run with GPT-5.6 Sol at medium effort. Full access is active.',
  },
]

function HarnessLogo({ harness, className = 'size-4' }: { harness: HarnessKey; className?: string }) {
  const lightSource = harness === 'codex' ? '/prototype-assets/codex.png' : '/prototype-assets/claude-code.svg'
  const darkSource = harness === 'codex' ? '/prototype-assets/codex.png' : '/prototype-assets/claude-code-dark.svg'
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden rounded-sm ${className}`}>
      <img src={lightSource} alt="" className="size-full object-contain dark:hidden" />
      <img src={darkSource} alt="" className="hidden size-full object-contain dark:block" />
    </span>
  )
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

function RunSetupMenu({ state, setState }: StateProps) {
  const definition = HARNESSES[state.harness]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton variant="ghost" className="max-w-80 text-foreground" aria-label="Choose run setup" />}
      >
        <HarnessLogo harness={state.harness} />
        <span>{definition.label}</span>
        <span className="text-muted-foreground">/</span>
        <span>{state.model}</span>
        <span className="text-muted-foreground">/</span>
        <span>{state.effort}</span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Run setup</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HarnessLogo harness={state.harness} />
              Harness
              <span className="ml-auto text-muted-foreground">{definition.label}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {(Object.keys(HARNESSES) as HarnessKey[]).map((harness) => (
                <DropdownMenuItem key={harness} onClick={() => setState(selectHarness(state, harness))}>
                  <HarnessLogo harness={harness} />
                  {HARNESSES[harness].label}
                  <SelectionMark active={state.harness === harness} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Bot />Model
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
              <BrainCircuit />Effort
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PermissionMenu({ state, setState }: StateProps) {
  const definition = HARNESSES[state.harness]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton variant="ghost" className="text-foreground" aria-label="Choose permission mode" />}
      >
        <ShieldCheck />{state.permission}<ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{definition.label} permissions</DropdownMenuLabel>
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

function ContextPopover({ state }: { state: ComposerState }) {
  const context = HARNESSES[state.harness].context
  const percentage = contextPercentage(state)
  return (
    <Popover>
      <PopoverTrigger
        render={<InputGroupButton variant={percentage >= 70 ? 'secondary' : 'ghost'} className="text-foreground" />}
      >
        <CircleGauge />Context {percentage}%
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Context window</PopoverTitle>
          <PopoverDescription>
            {(context.used / 1000).toFixed(0)}k of {(context.total / 1000).toFixed(0)}k tokens used · {percentage}%
          </PopoverDescription>
        </PopoverHeader>
        <Progress value={percentage} />
        {percentage >= 70 && (
          <div className="grid gap-3 rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Compact this task before the next large change.
            </p>
            <div className="flex gap-2">
              <Button size="sm"><RotateCcw />Compact</Button>
              {percentage >= 90 && <Button variant="outline" size="sm"><ArrowRight />Handoff</Button>}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function UsagePopover({ state }: { state: ComposerState }) {
  const definition = HARNESSES[state.harness]
  return (
    <Popover>
      <PopoverTrigger render={<InputGroupButton variant="ghost" className="text-foreground" />}>
        <Gauge />Usage
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>{definition.label} usage</PopoverTitle>
          <PopoverDescription>Limits reported by the active harness</PopoverDescription>
        </PopoverHeader>
        {definition.usage.map((item) => (
          <div key={item.label} className="grid gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>
              <span className="w-8 text-right text-xs tabular-nums">{item.percentage}%</span>
            </div>
            <Progress value={item.percentage} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function TranscriptRow({ message }: { message: MessageRow }) {
  if (message.role === 'marker') {
    return <Marker variant="separator"><MarkerContent>{message.text}</MarkerContent></Marker>
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

export function ComposerPrototype() {
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

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages([
      ...messages,
      { id: `turn-${messages.length + 1}`, role: 'user', text },
      {
        id: `turn-${messages.length + 2}`,
        role: 'assistant',
        text: `${HARNESSES[state.harness].label} received the instruction with ${state.model} at ${state.effort.toLowerCase()} effort.`,
      },
    ])
    setDraft('')
  }

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background" data-prototype="composer">
      <div className="min-h-0 flex-1">
        <Transcript messages={messages} />
      </div>
      <div className="relative shrink-0 bg-gradient-to-t from-background via-background to-transparent px-8 pt-8 pb-12">
        <form
          className="mx-auto w-full max-w-4xl"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          <InputGroup className="overflow-hidden rounded-xl bg-background shadow-xl shadow-foreground/10">
            <ReferenceStrip state={state} setState={setState} />
            <InputGroupTextarea
              aria-label="Message"
              placeholder="Direct the next move…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-20 px-4 py-3 text-sm leading-6"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send()
                }
              }}
            />
            <InputGroupAddon align="block-end" className="gap-1 border-t bg-muted/20 px-2.5 py-2">
              <AddContextMenu state={state} setState={setState} />
              <RunSetupMenu state={state} setState={setState} />
              <PermissionMenu state={state} setState={setState} />
              <div className="ml-auto flex items-center gap-1">
                <ContextPopover state={state} />
                <UsagePopover state={state} />
                <InputGroupButton
                  size="icon-sm"
                  variant={isListening ? 'secondary' : 'ghost'}
                  className="text-foreground"
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
      </div>
    </main>
  )
}
