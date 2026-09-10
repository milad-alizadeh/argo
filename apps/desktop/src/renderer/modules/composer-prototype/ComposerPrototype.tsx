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
  CornerDownRight,
  Ellipsis,
  File,
  Folder,
  Gauge,
  GripVertical,
  Info,
  Mic,
  Paperclip,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
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
type VariantKey = 'A' | 'B' | 'C' | 'D' | 'E'
type MessageRow = { id: string; role: 'user' | 'assistant' | 'marker'; text: string }
type QueuedMessage = { id: string; text: string }

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

const MODEL_DESCRIPTIONS: Record<HarnessKey, Record<string, string>> = {
  codex: {
    'GPT-5.6 Sol': 'Best for complex coding and deep reasoning',
    'GPT-5.6 Terra': 'Balanced for everyday implementation',
    'GPT-5.6 Luna': 'Fast for focused edits and iteration',
  },
  claude: {
    'Opus 5': 'Most capable for architecture and hard problems',
    'Sonnet 5': 'Balanced for daily coding and review',
    'Haiku 4.5': 'Fast for small changes and quick answers',
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
  const lightSource = harness === 'codex' ? '/prototype-assets/codex.png' : '/prototype-assets/claude.ico'
  const darkSource = harness === 'codex' ? '/prototype-assets/codex.png' : '/prototype-assets/claude.ico'
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

function contextZone(percentage: number) {
  if (percentage <= 20) {
    return { label: 'Smart Zone', badge: 'bg-emerald-600 text-white', fill: 'bg-emerald-500', text: 'text-emerald-600', dot: 'bg-emerald-500' }
  }
  if (percentage <= 40) {
    return { label: 'Nearing Dumb Zone', badge: 'bg-amber-400 text-amber-950', fill: 'bg-amber-400', text: 'text-amber-600', dot: 'bg-amber-400' }
  }
  return { label: 'Dumb Zone', badge: 'bg-red-600 text-white', fill: 'bg-red-500', text: 'text-red-600', dot: 'bg-red-500' }
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
  const effortIndex = Math.max(0, definition.efforts.indexOf(state.effort))
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
      <DropdownMenuContent align="start" side="top" className="w-[23rem] overflow-hidden p-0">
        <div className="border-b p-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Harness">
            {(Object.keys(HARNESSES) as HarnessKey[]).map((harness) => {
              const active = state.harness === harness
              return (
                <button
                  key={harness}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setState(selectHarness(state, harness))}
                  className={`flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${
                    active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <HarnessLogo harness={harness} />
                  {HARNESSES[harness].label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="p-2.5">
            <div className="px-1 pb-1.5 text-[11px] font-medium text-muted-foreground">Model</div>
            <div className="space-y-0.5" role="listbox" aria-label="Model">
              {definition.models.map((model) => {
                const active = state.model === model
                return (
                  <button
                    key={model}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setState({ ...state, model })}
                    className={`flex min-h-12 w-full items-center rounded-md px-2.5 py-1.5 text-left transition-colors ${
                      active ? 'bg-foreground text-background' : 'hover:bg-muted'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{model}</span>
                      <span className={`mt-0.5 block text-[11px] leading-4 ${active ? 'text-background/65' : 'text-muted-foreground'}`}>
                        {MODEL_DESCRIPTIONS[state.harness][model]}
                      </span>
                    </span>
                    {active ? <Check className="ml-auto size-4" /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t p-2.5">
            <div className="flex items-center">
              <div className="text-xs font-medium text-muted-foreground">Effort</div>
              <span className="ml-auto text-[10px] text-muted-foreground">
                More effort trades speed for deeper reasoning.
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, definition.efforts.length - 1)}
              step={1}
              value={effortIndex}
              aria-label="Effort"
              onChange={(event) => {
                const effort = definition.efforts[Number(event.currentTarget.value)]
                if (effort) setState({ ...state, effort })
              }}
              className="mt-3 h-1.5 w-full cursor-pointer accent-foreground"
            />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              {definition.efforts.map((effort) => (
                <span key={effort} className={state.effort === effort ? 'font-semibold text-foreground' : ''}>{effort}</span>
              ))}
            </div>
          </div>
        </div>
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

function ContextPopover({
  state,
  appearance = 'compact',
  meterStyle = 'solid',
}: {
  state: ComposerState
  appearance?: 'compact' | 'details'
  meterStyle?: 'solid' | 'gradient'
}) {
  const context = HARNESSES[state.harness].context
  const percentage = contextPercentage(state)
  const smartZonePercentage = 20
  const zone = contextZone(percentage)
  const contextStatus = zone.label
  const claudeComposition = [
    { label: 'Conversation', value: '86k', percentage: 71 },
    { label: 'System prompt', value: '16k', percentage: 13 },
    { label: 'MCP tools', value: '10k', percentage: 8 },
    { label: 'Memory files', value: '6k', percentage: 5 },
    { label: 'Skills', value: '3k', percentage: 3 },
  ]
  return (
    <Popover>
      <PopoverTrigger
        render={appearance === 'compact'
          ? <InputGroupButton variant="secondary" className="h-auto gap-2 px-2.5 py-1.5 text-foreground" />
          : <Button variant="ghost" size="icon" className="size-7" aria-label="Context details" />}
      >
        {appearance === 'compact' ? (
          <>
            <CircleGauge className="size-4" />
            <span className="text-xs font-semibold">{contextStatus}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{percentage}%</span>
          </>
        ) : <Info className="size-4" />}
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[28rem] gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            Context health
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${zone.badge}`}>{contextStatus}</span>
          </PopoverTitle>
          <PopoverDescription>
            Current context compared with the working smart-zone target.
          </PopoverDescription>
        </PopoverHeader>

        <div className="rounded-xl border p-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Active context</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {(context.used / 1000).toFixed(0)}k <span className="text-sm font-normal text-muted-foreground">/ {(context.total / 1000).toFixed(0)}k</span>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-medium">Smart Zone ~{smartZonePercentage}%</div>
              <div className="text-muted-foreground">Current · {percentage}% used</div>
            </div>
          </div>
          <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`absolute inset-y-0 left-0 ${meterStyle === 'gradient' ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500' : zone.fill}`}
              style={{ width: `${percentage}%` }}
            />
            <div className="absolute inset-y-[-3px] w-0.5 bg-foreground" style={{ left: `${smartZonePercentage}%` }} />
          </div>
          <p className="mt-2 text-xs leading-4 text-muted-foreground">
            This session is in the {contextStatus}. Compact or hand off before starting another substantial phase.
          </p>
        </div>

        {meterStyle === 'solid' ? (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Smart · 0–20%</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />Nearing dumb · 20–40%</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" />Dumb · 40%+</span>
          </div>
        ) : null}

        {state.harness === 'claude' ? (
          <div className="grid gap-2">
            <div className="flex items-center">
              <span className="text-xs font-semibold">What is loaded</span>
              <span className="ml-auto text-[10px] text-muted-foreground">Sample /context · 35k static load</span>
            </div>
            {claudeComposition.map((item) => (
              <div key={item.label} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <Progress value={item.percentage} className="h-1.5" />
                <span className="text-right tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-[10px] leading-4 text-muted-foreground">
          The 20% boundary is a workflow target, not a model guarantee.
        </p>
        {percentage >= 70 && appearance === 'compact' && (
          <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Compact this task before the next large change.
            </p>
            <div className="ml-auto flex shrink-0 gap-2">
              <Button size="sm"><RotateCcw />Compact</Button>
              <Button variant="outline" size="sm"><ArrowRight />Handoff</Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function ContextSurface({ state, layout }: { state: ComposerState; layout: 'inline' | 'dock' | 'footer' | 'attached' }) {
  const context = HARNESSES[state.harness].context
  const percentage = contextPercentage(state)
  const used = `${(context.used / 1000).toFixed(0)}k`
  const zone = contextZone(percentage)
  const status = zone.label

  if (layout === 'footer') {
    return (
      <div className="flex items-center gap-3 border-t bg-muted/10 px-3 py-2.5">
        <CircleGauge className={`size-4 shrink-0 ${zone.text}`} />
        <div className="shrink-0">
          <div className="flex items-center gap-1 text-xs font-semibold">
            Context · {status}
            <ContextPopover state={state} appearance="details" />
          </div>
          <div className="text-[10px] text-muted-foreground">Smart Zone ~20%</div>
        </div>
        <div className="min-w-28 flex-1">
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div className={`absolute inset-y-0 left-0 ${zone.fill}`} style={{ width: `${percentage}%` }} />
            <div className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: '20%' }} />
          </div>
        </div>
        <div className="shrink-0 text-xs tabular-nums">
          <span className="font-semibold">{used}</span>
          <span className="text-muted-foreground"> / 200k total</span>
        </div>
        <div className="ml-1 flex shrink-0 items-center gap-1 border-l pl-3">
          <Button variant="secondary" size="sm"><RotateCcw />Compact</Button>
          <Button variant="outline" size="sm"><ArrowRight />Handoff</Button>
        </div>
      </div>
    )
  }

  if (layout === 'attached') {
    return (
      <div className="flex items-center gap-3 rounded-b-xl border border-t-0 bg-muted/40 px-4 pb-2.5 pt-3 shadow-md shadow-foreground/10">
        <CircleGauge className={`size-4 shrink-0 ${zone.text}`} />
        <div className="shrink-0">
          <div className="flex items-center gap-1 text-xs font-semibold">
            Context · {status} · {percentage}%
            <ContextPopover state={state} appearance="details" meterStyle="gradient" />
          </div>
          <div className="text-[10px] text-muted-foreground">Smart Zone ~20%</div>
        </div>
        <div className="min-w-28 flex-1">
          <div className="relative h-2 overflow-hidden rounded-full bg-background">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
              style={{ width: `${percentage}%` }}
            />
            <div className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: '20%' }} />
          </div>
        </div>
        <div className="shrink-0 text-xs tabular-nums">
          <span className="font-semibold">{used}</span>
          <span className="text-muted-foreground"> / 200k</span>
        </div>
        <div className="ml-1 flex shrink-0 items-center gap-1 border-l pl-3">
          <Button variant="secondary" size="sm"><RotateCcw />Compact</Button>
          <Button variant="outline" size="sm"><ArrowRight />Handoff</Button>
        </div>
      </div>
    )
  }

  if (layout === 'inline') {
    return (
      <aside className="absolute bottom-11 right-0 top-0 z-10 flex w-72 flex-col border-l bg-background p-3">
        <div className="flex items-center gap-2">
        <CircleGauge className={`size-4 ${zone.text}`} />
          <span className="flex items-center gap-1 text-xs font-semibold">
            Context
            <ContextPopover state={state} appearance="details" />
          </span>
          <span className="ml-auto text-xs tabular-nums">{percentage}% used</span>
        </div>
        <div className="mt-3 text-lg font-semibold tabular-nums">
          {used} <span className="text-xs font-normal text-muted-foreground">/ 200k total</span>
        </div>
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className={`absolute inset-y-0 left-0 ${zone.fill}`} style={{ width: `${percentage}%` }} />
          <div className="absolute inset-y-0 border-x border-foreground bg-foreground/10" style={{ left: '62.5%', width: '12.5%' }} />
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">Smart Zone ~20%</div>
        <div className="mt-auto flex items-center gap-1">
          <Button variant="secondary" size="sm" className="px-2"><RotateCcw />Compact</Button>
          <Button variant="outline" size="sm" className="px-2"><ArrowRight />Handoff</Button>
        </div>
      </aside>
    )
  }

  return (
    <div className="mb-2 rounded-xl border bg-background px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <CircleGauge className={`size-4 shrink-0 ${zone.text}`} />
        <div className="shrink-0">
          <div className="flex items-center gap-1 text-xs font-semibold">
            Context · {status}
            <ContextPopover state={state} appearance="details" />
          </div>
          <div className="text-[10px] text-muted-foreground">Smart Zone ~20%</div>
        </div>
        <div className="min-w-24 flex-1">
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div className={`absolute inset-y-0 left-0 ${zone.fill}`} style={{ width: `${percentage}%` }} />
            <div className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: '20%' }} />
          </div>
        </div>
        <div className="shrink-0 text-right text-xs tabular-nums">
          <span className="font-semibold">{used}</span>
          <span className="text-muted-foreground"> / 200k total</span>
        </div>
        <Button variant="secondary" size="sm"><RotateCcw />Compact</Button>
        <Button variant="outline" size="sm"><ArrowRight />Handoff</Button>
      </div>
    </div>
  )
}

function VariantSwitcher({ variant }: { variant: VariantKey }) {
  const variants: { key: VariantKey; label: string }[] = [
    { key: 'A', label: 'Popover' },
    { key: 'B', label: 'Side rail' },
    { key: 'C', label: 'Dock' },
    { key: 'D', label: 'Footer bar' },
    { key: 'E', label: 'Attached' },
  ]
  return (
    <nav className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur" aria-label="Prototype variants">
      {variants.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            const url = new URL(window.location.href)
            url.searchParams.set('variant', item.key)
            window.location.href = url.toString()
          }}
          className={`rounded-full px-3 py-1.5 text-xs ${variant === item.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {item.key} · {item.label}
        </button>
      ))}
    </nav>
  )
}

function QueuePreview({
  messages,
  layout,
  onSteer,
  onRemove,
}: {
  messages: QueuedMessage[]
  layout: 'attached' | 'inline' | 'floating' | 'integrated'
  onSteer: (message: QueuedMessage) => void
  onRemove: (id: string) => void
}) {
  const message = messages[0]
  if (!message) return null
  if (layout === 'integrated') {
    return (
      <div className="divide-y border-b bg-muted/20">
        {messages.map((queuedMessage) => (
          <div key={queuedMessage.id} className="flex min-h-11 items-center gap-2 px-3 py-2">
            <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
            <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs">{queuedMessage.text}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onSteer(queuedMessage)}>
              <ArrowRight />Steer
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove queued message: ${queuedMessage.text}`} onClick={() => onRemove(queuedMessage.id)}>
              <Trash2 />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for queued message: ${queuedMessage.text}`}>
              <Ellipsis />
            </Button>
          </div>
        ))}
      </div>
    )
  }
  const shell = {
    attached: 'relative z-0 mx-auto -mb-2 w-[calc(100%-1.5rem)] max-w-[calc(56rem-1.5rem)] rounded-t-xl border bg-muted/40 px-3 pb-4 pt-2.5 shadow-sm',
    inline: 'mr-72 flex border-b bg-muted/20 px-3 py-2',
    floating: 'mb-2 ml-auto w-3/4 rounded-lg border bg-background px-3 py-2 shadow-sm',
    integrated: '',
  }[layout]
  return (
    <div className={`${shell} flex items-center gap-2`}>
      <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
        {messages.length} queued
      </span>
      <span className="min-w-0 flex-1 truncate text-xs">{message.text}</span>
      <Button type="button" variant="ghost" size="sm" onClick={() => onSteer(message)}>
        <ArrowRight />Steer
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove queued message" onClick={() => onRemove(message.id)}>
        <Trash2 />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="More queue actions">
        <Ellipsis />
      </Button>
    </div>
  )
}

function UsagePopover({ state }: { state: ComposerState }) {
  const definition = HARNESSES[state.harness]
  const primaryUsage = definition.usage.reduce((highest, item) => item.percentage > highest.percentage ? item : highest)
  return (
    <Popover>
      <PopoverTrigger render={<InputGroupButton variant="ghost" className="gap-1.5 px-2 text-foreground" />}>
        <Gauge className="size-4" />
        <span className="text-xs font-medium">Usage</span>
        <span className="text-xs tabular-nums text-muted-foreground">{primaryUsage.percentage}%</span>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>{definition.label} plan usage</PopoverTitle>
          <PopoverDescription>Account allowance, separate from context health</PopoverDescription>
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
  const requestedVariant = new URLSearchParams(window.location.search).get('variant')
  const variant: VariantKey = requestedVariant === 'B' || requestedVariant === 'C' || requestedVariant === 'D' || requestedVariant === 'E' ? requestedVariant : 'A'
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
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([
    { id: 'queued-1', text: 'Update the empty state, then verify the composer at compact widths.' },
    { id: 'queued-2', text: 'Capture the selected direction for implementation.' },
  ])

  const steerQueuedMessage = (message: QueuedMessage) => {
    setDraft(message.text)
    setQueuedMessages(queuedMessages.filter((item) => item.id !== message.id))
  }
  const removeQueuedMessage = (id: string) => {
    setQueuedMessages(queuedMessages.filter((item) => item.id !== id))
  }

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
        {variant === 'C' && <div className="mx-auto w-full max-w-4xl"><ContextSurface state={state} layout="dock" /></div>}
        {variant === 'A' && (
          <QueuePreview messages={queuedMessages} layout="attached" onSteer={steerQueuedMessage} onRemove={removeQueuedMessage} />
        )}
        {variant === 'C' && (
          <div className="mx-auto w-full max-w-4xl">
            <QueuePreview messages={queuedMessages} layout="floating" onSteer={steerQueuedMessage} onRemove={removeQueuedMessage} />
          </div>
        )}
        <form
          className="relative z-10 mx-auto w-full max-w-4xl"
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          <InputGroup className="relative overflow-hidden rounded-xl bg-background shadow-xl shadow-foreground/10">
            {variant === 'B' && <QueuePreview messages={queuedMessages} layout="inline" onSteer={steerQueuedMessage} onRemove={removeQueuedMessage} />}
            {variant === 'D' && <QueuePreview messages={queuedMessages} layout="integrated" onSteer={steerQueuedMessage} onRemove={removeQueuedMessage} />}
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
                {variant === 'A' && <ContextPopover state={state} />}
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
            {(variant === 'B' || variant === 'D') && <ContextSurface state={state} layout="footer" />}
          </InputGroup>
        </form>
        {variant === 'E' && (
          <div className="relative z-0 mx-auto -mt-px w-[calc(100%-1.5rem)] max-w-[calc(56rem-1.5rem)]">
            <ContextSurface state={state} layout="attached" />
          </div>
        )}
      </div>
      <VariantSwitcher variant={variant} />
    </main>
  )
}
