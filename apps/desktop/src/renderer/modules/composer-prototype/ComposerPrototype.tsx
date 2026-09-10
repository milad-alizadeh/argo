// Three composer placements, switchable with ?variant=A, on the existing cockpit surface (#1258).
import {
  ArrowDownToLine,
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/renderer/components/ui/badge'
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
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/renderer/components/ui/popover'
import { Progress } from '@/renderer/components/ui/progress'
import { Separator } from '@/renderer/components/ui/separator'
import { Textarea } from '@/renderer/components/ui/textarea'

type HarnessKey = 'codex' | 'claude'
type VariantKey = 'A' | 'B' | 'C'

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

const HARNESS_DEFINITIONS: Record<HarnessKey, HarnessDefinition> = {
  codex: {
    label: 'Codex',
    models: ['GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna'],
    efforts: ['Low', 'Medium', 'High', 'Extra high'],
    permissions: [
      { label: 'Ask for approval', detail: 'Ask before external access' },
      { label: 'Approve for me', detail: 'Ask only when an action looks unsafe' },
      { label: 'Full access', detail: 'Use files and the internet without asking' },
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
      { label: 'Accept edits', detail: 'Accept all file edits automatically' },
      { label: 'Plan', detail: 'Create a plan before making changes' },
      { label: 'Bypass permissions', detail: 'Run without permission checks' },
    ],
    context: { used: 121_000, total: 200_000 },
    usage: [
      { label: '5-hour limit', detail: 'Resets in 4 hr 5 min', percentage: 8 },
      { label: 'Weekly, all models', detail: 'Resets Saturday at 6:00 PM', percentage: 65 },
      { label: 'Weekly, Opus', detail: 'Resets Saturday at 6:00 PM', percentage: 12 },
    ],
  },
}

const VARIANT_NAMES: Record<VariantKey, string> = {
  A: 'Instrument strip',
  B: 'Context shelf',
  C: 'Side inspector',
}

function HarnessIcon({ harness, className }: { harness: HarnessKey; className?: string }) {
  return harness === 'codex' ? <Hexagon className={className} /> : <Sparkles className={className} />
}

function chooseHarness(state: ComposerState, harness: HarnessKey): ComposerState {
  const definition = HARNESS_DEFINITIONS[harness]
  return {
    ...state,
    harness,
    model: definition.models[0] ?? '',
    effort: definition.efforts[1] ?? definition.efforts[0] ?? '',
    permission: definition.permissions[0]?.label ?? '',
  }
}

function SelectionMark({ selected }: { selected: boolean }) {
  return <span className="ml-auto w-4">{selected ? <Check className="size-4" /> : null}</span>
}

function HarnessMenuItems({ state, setState }: StateProps) {
  return (
    <>
      {(Object.keys(HARNESS_DEFINITIONS) as HarnessKey[]).map((harness) => (
        <DropdownMenuItem key={harness} onClick={() => setState(chooseHarness(state, harness))}>
          <HarnessIcon harness={harness} />
          {HARNESS_DEFINITIONS[harness].label}
          <SelectionMark selected={state.harness === harness} />
        </DropdownMenuItem>
      ))}
    </>
  )
}

type StateProps = {
  state: ComposerState
  setState: (state: ComposerState) => void
}

function ConfigurationMenu({ state, setState, compact = false }: StateProps & { compact?: boolean }) {
  const definition = HARNESS_DEFINITIONS[state.harness]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size={compact ? 'sm' : 'default'} aria-label="Choose harness settings" />
        }
      >
        <HarnessIcon harness={state.harness} />
        <span>{compact ? state.model : definition.label}</span>
        {!compact && <span className="text-muted-foreground">{state.model}</span>}
        {!compact && <span className="text-muted-foreground">{state.effort}</span>}
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-72">
        <DropdownMenuLabel>Run settings</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HarnessIcon harness={state.harness} />
            Harness
            <span className="ml-auto text-muted-foreground">{definition.label}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <HarnessMenuItems state={state} setState={setState} />
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
                {model}
                <SelectionMark selected={state.model === model} />
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
                {effort}
                <SelectionMark selected={state.effort === effort} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ShieldCheck />
            Permissions
            <span className="ml-auto text-muted-foreground">{state.permission}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
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
                <SelectionMark selected={state.permission === permission.label} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AddMenu({ state, setState }: StateProps) {
  const add = (label: string) => {
    if (!state.attachments.includes(label)) setState({ ...state, attachments: [...state.attachments, label] })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Add context" />}>
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel>Add to this task</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => add('architecture.png')}><Paperclip />Add attachment</DropdownMenuItem>
        <DropdownMenuItem onClick={() => add('ComposerPrototype.tsx')}><File />Add file reference</DropdownMenuItem>
        <DropdownMenuItem onClick={() => add('apps/desktop')}><Folder />Add folder reference</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => add('$prototype')}><WandSparkles />Add skill</DropdownMenuItem>
        <DropdownMenuItem onClick={() => add('/review')}><Command />Add command</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AttachmentChips({ state, setState }: StateProps) {
  if (state.attachments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-3">
      {state.attachments.map((attachment) => (
        <Badge key={attachment} variant="secondary" className="gap-1.5">
          {attachment}
          <button
            type="button"
            aria-label={`Remove ${attachment}`}
            onClick={() => setState({ ...state, attachments: state.attachments.filter((item) => item !== attachment) })}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

function ComposerActions({ isListening, setIsListening }: { isListening: boolean; setIsListening: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={isListening ? 'secondary' : 'ghost'}
        size="icon"
        aria-label={isListening ? 'Stop listening' : 'Use microphone'}
        onClick={() => setIsListening(!isListening)}
      >
        <Mic />
      </Button>
      <Button size="icon" aria-label="Send message"><ArrowUp /></Button>
    </div>
  )
}

function ContextSummary({ state, expanded = false }: { state: ComposerState; expanded?: boolean }) {
  const definition = HARNESS_DEFINITIONS[state.harness]
  const percentage = Math.round((definition.context.used / definition.context.total) * 100)
  return (
    <div className={expanded ? 'grid gap-3' : 'grid gap-2'}>
      <div className="flex items-center gap-2 text-sm">
        <CircleGauge className="size-4 text-muted-foreground" />
        <span className="font-medium">Context window</span>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {(definition.context.used / 1000).toFixed(0)}k / {(definition.context.total / 1000).toFixed(0)}k · {percentage}%
        </span>
      </div>
      <Progress value={percentage} />
      {percentage >= 70 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-2.5">
          <p className="text-xs text-muted-foreground">This task is getting dense. Create room before the next large change.</p>
          <div className="flex shrink-0 gap-1">
            <Button variant="outline" size="sm"><RotateCcw />Compact</Button>
            <Button variant="secondary" size="sm"><ArrowRight />Handoff</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function UsageDetails({ state }: { state: ComposerState }) {
  const definition = HARNESS_DEFINITIONS[state.harness]
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{definition.label} usage</p>
          <p className="text-xs text-muted-foreground">Limits from the active harness</p>
        </div>
      </div>
      {definition.usage.map((usage) => (
        <div key={usage.label} className="grid gap-1.5">
          <div className="flex items-baseline gap-2 text-sm">
            <span>{usage.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{usage.detail}</span>
            <span className="w-8 text-right tabular-nums">{usage.percentage}%</span>
          </div>
          <Progress value={usage.percentage} />
        </div>
      ))}
    </div>
  )
}

function MetricsPopover({ state }: { state: ComposerState }) {
  const definition = HARNESS_DEFINITIONS[state.harness]
  const percentage = Math.round((definition.context.used / definition.context.total) * 100)
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" aria-label="View context and usage" />}>
        <CircleGauge />
        <span className="tabular-nums">{percentage}%</span>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Task capacity</PopoverTitle>
          <PopoverDescription>Live readings from {definition.label}</PopoverDescription>
        </PopoverHeader>
        <ContextSummary state={state} expanded />
        <Separator />
        <UsageDetails state={state} />
      </PopoverContent>
    </Popover>
  )
}

function ComposerField({ placeholder = 'Describe a task or ask a question' }: { placeholder?: string }) {
  return <Textarea aria-label="Message" placeholder={placeholder} className="min-h-24 resize-none border-0 bg-transparent p-3 text-base shadow-none focus-visible:ring-0 dark:bg-transparent" />
}

function VariantA({ state, setState, isListening, setIsListening }: VariantProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 pb-24">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-xl shadow-foreground/5">
        <AttachmentChips state={state} setState={setState} />
        <ComposerField />
        <div className="flex min-h-14 items-center gap-1 border-t bg-muted/30 px-2">
          <AddMenu state={state} setState={setState} />
          <Badge variant="outline" className="hidden sm:inline-flex"><ShieldCheck />{state.permission}</Badge>
          <div className="ml-auto flex items-center gap-1">
            <MetricsPopover state={state} />
            <ConfigurationMenu state={state} setState={setState} />
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ComposerActions isListening={isListening} setIsListening={setIsListening} />
          </div>
        </div>
      </div>
    </div>
  )
}

function VariantB({ state, setState, isListening, setIsListening }: VariantProps) {
  return (
    <div className="mx-auto w-full max-w-4xl px-8 pb-24">
      <div className="rounded-3xl border bg-background p-2 shadow-2xl shadow-foreground/5">
        <div className="grid gap-4 rounded-2xl bg-muted/50 p-4 md:grid-cols-[1fr_auto]">
          <ContextSummary state={state} expanded />
          <Popover>
            <PopoverTrigger render={<Button variant="outline" className="self-start" />}>
              <Gauge />Usage
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-96 p-4"><UsageDetails state={state} /></PopoverContent>
          </Popover>
        </div>
        <AttachmentChips state={state} setState={setState} />
        <ComposerField placeholder="What do you want to make next?" />
        <div className="flex items-center gap-1 px-1 pb-1">
          <AddMenu state={state} setState={setState} />
          <ConfigurationMenu state={state} setState={setState} compact />
          <Badge variant="ghost" className="hidden sm:inline-flex"><ShieldCheck />{state.permission}</Badge>
          <div className="ml-auto"><ComposerActions isListening={isListening} setIsListening={setIsListening} /></div>
        </div>
      </div>
    </div>
  )
}

function InspectorSelection({ state, setState }: StateProps) {
  const definition = HARNESS_DEFINITIONS[state.harness]
  const rows = [
    { label: 'Model', value: state.model, values: definition.models, icon: Bot },
    { label: 'Effort', value: state.effort, values: definition.efforts, icon: BrainCircuit },
    { label: 'Permissions', value: state.permission, values: definition.permissions.map((item) => item.label), icon: ShieldCheck },
  ]
  return (
    <div className="grid gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="secondary" className="h-auto justify-start px-3 py-2.5" />}>
          <HarnessIcon harness={state.harness} />
          <span className="grid text-left"><span>{definition.label}</span><span className="text-xs font-normal text-muted-foreground">Active harness</span></span>
          <ChevronDown className="ml-auto" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60"><HarnessMenuItems state={state} setState={setState} /></DropdownMenuContent>
      </DropdownMenu>
      {rows.map((row) => (
        <DropdownMenu key={row.label}>
          <DropdownMenuTrigger render={<Button variant="ghost" className="h-auto justify-start px-3 py-2" />}>
            <row.icon />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto">{row.value}</span>
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {row.values.map((value) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setState({ ...state, [row.label === 'Model' ? 'model' : row.label === 'Effort' ? 'effort' : 'permission']: value })}
              >
                {value}<SelectionMark selected={row.value === value} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  )
}

function VariantC({ state, setState, isListening, setIsListening }: VariantProps) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-3 px-8 pb-24 md:grid-cols-[1fr_19rem]">
      <div className="flex min-h-64 flex-col rounded-2xl border bg-background shadow-xl shadow-foreground/5">
        <AttachmentChips state={state} setState={setState} />
        <ComposerField placeholder="Ask Argo to explore, build, or explain…" />
        <div className="mt-auto flex items-center border-t p-2">
          <AddMenu state={state} setState={setState} />
          <p className="ml-1 hidden text-xs text-muted-foreground sm:block">Drop files anywhere in the composer</p>
          <div className="ml-auto"><ComposerActions isListening={isListening} setIsListening={setIsListening} /></div>
        </div>
      </div>
      <aside className="grid content-start gap-4 rounded-2xl border bg-background p-3 shadow-xl shadow-foreground/5">
        <InspectorSelection state={state} setState={setState} />
        <Separator />
        <ContextSummary state={state} />
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="w-full" />}><Gauge />View usage</PopoverTrigger>
          <PopoverContent align="end" side="left" className="w-96 p-4"><UsageDetails state={state} /></PopoverContent>
        </Popover>
      </aside>
    </div>
  )
}

type VariantProps = StateProps & {
  isListening: boolean
  setIsListening: (value: boolean) => void
}

function BackgroundConversation({ variant }: { variant: VariantKey }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end gap-8 px-8 py-12 opacity-70">
      <div className="max-w-xl space-y-2">
        <p className="text-sm font-medium">You</p>
        <p className="text-sm text-muted-foreground">Bring the context readings closer to the composer without making it feel crowded.</p>
      </div>
      <div className="max-w-2xl space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium"><Bot className="size-4" />Argo</div>
        <p className="text-sm leading-6 text-muted-foreground">I mapped the controls to the active harness. The current direction keeps task capacity visible while the writing surface remains the primary action.</p>
      </div>
      <Badge variant="outline" className="w-fit">Exploring {VARIANT_NAMES[variant]}</Badge>
    </div>
  )
}

function PrototypeSwitcher({ variant, onChange }: { variant: VariantKey; onChange: (variant: VariantKey) => void }) {
  const variants: VariantKey[] = ['A', 'B', 'C']
  const move = (direction: number) => {
    const index = variants.indexOf(variant)
    onChange(variants[(index + direction + variants.length) % variants.length] ?? 'A')
  }
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-foreground p-1 text-background shadow-2xl">
      <Button variant="ghost" size="icon-sm" className="text-background hover:bg-background/15 hover:text-background" aria-label="Previous variant" onClick={() => move(-1)}><ArrowLeft /></Button>
      <div className="min-w-44 px-3 text-center text-xs font-medium">{variant} · {VARIANT_NAMES[variant]}</div>
      <Button variant="ghost" size="icon-sm" className="text-background hover:bg-background/15 hover:text-background" aria-label="Next variant" onClick={() => move(1)}><ArrowRight /></Button>
    </div>
  )
}

function PrototypeState({ state, isListening }: { state: ComposerState; isListening: boolean }) {
  return (
    <div className="fixed right-4 bottom-4 z-40 hidden max-w-sm items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur xl:flex">
      <CircleGauge className="size-3.5" />
      <span>{HARNESS_DEFINITIONS[state.harness].label}</span>
      <span>{state.model}</span>
      <span>{state.effort}</span>
      <span>{state.permission}</span>
      <span>{state.attachments.length} refs</span>
      {isListening && <span className="text-foreground">Listening</span>}
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
    model: HARNESS_DEFINITIONS.codex.models[0] ?? '',
    effort: HARNESS_DEFINITIONS.codex.efforts[1] ?? '',
    permission: HARNESS_DEFINITIONS.codex.permissions[2]?.label ?? '',
    attachments: ['$prototype'],
  })
  const [isListening, setIsListening] = useState(false)
  const changeVariant = useCallback((nextVariant: VariantKey) => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', nextVariant)
    window.history.replaceState(null, '', url)
    setVariant(nextVariant)
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const variants: VariantKey[] = ['A', 'B', 'C']
      const index = variants.indexOf(variant)
      const movement = event.key === 'ArrowRight' ? 1 : -1
      changeVariant(variants[(index + movement + variants.length) % variants.length] ?? 'A')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [changeVariant, variant])

  const variantProps = useMemo(
    () => ({ state, setState, isListening, setIsListening }),
    [isListening, state],
  )

  return (
    <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30" data-prototype="composer" data-variant={variant}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,var(--background),transparent_48%)]" />
      <BackgroundConversation variant={variant} />
      <div className="relative">
        {variant === 'A' && <VariantA {...variantProps} />}
        {variant === 'B' && <VariantB {...variantProps} />}
        {variant === 'C' && <VariantC {...variantProps} />}
      </div>
      <PrototypeSwitcher variant={variant} onChange={changeVariant} />
      <PrototypeState state={state} isListening={isListening} />
    </main>
  )
}
