// One composer direction after the blind UX and visual reviews selected the single-surface layout.
import {
  Archive,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CircleGauge,
  CircleHelp,
  Command,
  CornerDownRight,
  File,
  FileCheck2,
  Folder,
  FolderGit2,
  FolderKanban,
  GitBranch,
  GitFork,
  GripVertical,
  Hand,
  Info,
  Layers3,
  ListTodo,
  Map as MapIcon,
  Mic,
  Minimize2,
  Monitor,
  Moon,
  PanelRight,
  Paperclip,
  Pencil,
  Plus,
  Route,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Ticket,
  Trash2,
  Unlock,
  WandSparkles,
  X,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/renderer/components/ui/resizable'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip'
import { FeedPermission } from './feed/FeedAttention'
import {
  FeedEvidencePrototype,
  type FeedPrototypeEvidence,
  SessionFeedPrototype,
} from './SessionFeedPrototype'

type HarnessKey = 'codex' | 'claude'
type ContextPreview = 'smart' | 'warning' | 'dumb'
type UsagePreview = 'normal' | 'high'
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
  contextPreview: ContextPreview
  usagePreview: UsagePreview
}

type StateProps = {
  state: ComposerState
  setState: (state: ComposerState) => void
}

function IconLabel({ icon, children, className = '' }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium leading-none [&>img]:!size-4 [&>img]:shrink-0 [&>svg]:!size-4 [&>svg]:shrink-0 ${className}`}>
      {icon}
      <span className="leading-none">{children}</span>
    </span>
  )
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

type ComposerSuggestion = {
  label: string
  value: string
  detail: string
  kind: 'skill' | 'command' | 'file' | 'folder'
  frequent?: boolean
}

const SLASH_SUGGESTIONS: ComposerSuggestion[] = [
  { label: 'Grill Me', value: '/grill-me', detail: 'Pressure-test the brief before building', kind: 'skill', frequent: true },
  { label: 'Implement', value: '/implement', detail: 'Build an approved ticket', kind: 'skill', frequent: true },
  { label: 'Fast', value: '/fast', detail: 'Prefer speed and lighter reasoning', kind: 'command', frequent: true },
  { label: 'Prototype', value: '/prototype', detail: 'Explore a throwaway interface direction', kind: 'skill' },
  { label: 'Compact', value: '/compact', detail: 'Compress the current task context', kind: 'command' },
]

const MENTION_SUGGESTIONS: ComposerSuggestion[] = [
  { label: 'ComposerPrototype.tsx', value: '@ComposerPrototype.tsx', detail: 'Recently edited file', kind: 'file', frequent: true },
  { label: 'apps/desktop', value: '@apps/desktop', detail: 'Current project folder', kind: 'folder', frequent: true },
  { label: '$frontend-design', value: '@$frontend-design', detail: 'Frequently used skill', kind: 'skill', frequent: true },
  { label: 'AGENTS.md', value: '@AGENTS.md', detail: 'Repository instructions', kind: 'file' },
]

function composerSuggestions(draft: string) {
  const match = draft.match(/(^|\s)([/@])([^\s]*)$/)
  if (!match) return []
  const query = (match[3] ?? '').toLowerCase()
  const source = match[2] === '/' ? SLASH_SUGGESTIONS : MENTION_SUGGESTIONS
  return source.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query))
}

function insertComposerSuggestion(draft: string, suggestion: ComposerSuggestion) {
  return draft.replace(/(^|\s)([/@])([^\s]*)$/, `$1${suggestion.value} `)
}

type PrototypeSession = {
  id: string
  project: ProjectKey
  title: string
  harness: HarnessKey
  status: 'running' | 'waiting' | 'idle'
  activity: string
  ticket: number
  pullRequest: { number: number; state: 'open' | 'draft' | 'merged' }
  subagents: number
  updated: string
}

type ThemeMode = 'system' | 'light' | 'dark'
type ConciergePlacement = 'roster' | 'floating' | 'off'
type ProjectKey = 'argo' | 'fresco' | 'posthog'

const PROTOTYPE_SESSIONS: PrototypeSession[] = [
  {
    id: 'session-design',
    project: 'argo',
    title: 'Continue Session design from composer',
    harness: 'codex',
    status: 'running',
    activity: 'Editing the Session shell',
    ticket: 1258,
    pullRequest: { number: 1931, state: 'draft' },
    subagents: 3,
    updated: 'now',
  },
  {
    id: 'roster-feed',
    project: 'argo',
    title: 'Restore the Session roster feed',
    harness: 'claude',
    status: 'waiting',
    activity: 'Waiting for review',
    ticket: 1907,
    pullRequest: { number: 1925, state: 'merged' },
    subagents: 0,
    updated: '12m',
  },
  {
    id: 'release-verdict',
    project: 'argo',
    title: 'Verify the release verdict guard',
    harness: 'codex',
    status: 'idle',
    activity: 'Packaged proof complete',
    ticket: 1807,
    pullRequest: { number: 1918, state: 'open' },
    subagents: 1,
    updated: '48m',
  },
  {
    id: 'adapter-contract',
    project: 'argo',
    title: 'Settle the Codex Session adapter contract',
    harness: 'claude',
    status: 'idle',
    activity: 'Reading adapter fixtures',
    ticket: 1764,
    pullRequest: { number: 1911, state: 'draft' },
    subagents: 2,
    updated: '2h',
  },
  {
    id: 'fresco-crop-controls',
    project: 'fresco',
    title: 'Polish image crop controls',
    harness: 'codex',
    status: 'waiting',
    activity: 'Waiting for visual review',
    ticket: 482,
    pullRequest: { number: 503, state: 'draft' },
    subagents: 1,
    updated: '26m',
  },
  {
    id: 'posthog-replay-gap',
    project: 'posthog',
    title: 'Trace the replay ingestion gap',
    harness: 'claude',
    status: 'idle',
    activity: 'Reading pipeline evidence',
    ticket: 29341,
    pullRequest: { number: 29402, state: 'open' },
    subagents: 2,
    updated: '1h',
  },
]

function HarnessLogo({ harness, className = 'size-(--size-icon-control)' }: { harness: HarnessKey; className?: string }) {
  const source = harness === 'codex' ? '/prototype-assets/openai-mono.svg' : '/prototype-assets/claude-mono.svg'
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <img src={source} alt="" className="size-full object-contain dark:invert" />
    </span>
  )
}

const PROJECTS: ProjectKey[] = ['argo', 'fresco', 'posthog']

function ConciergeOrb({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-foreground ${compact ? 'size-7' : 'size-11'}`}
    >
      <span className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--background),transparent_35%),conic-gradient(from_40deg,var(--muted-foreground),var(--background),var(--foreground),var(--muted-foreground))] opacity-90" />
      <span className="absolute inset-[30%] rounded-full border border-background/70" />
    </span>
  )
}

function ProjectManager({
  visibleProjects,
  onVisibilityChange,
}: {
  visibleProjects: ProjectKey[]
  onVisibilityChange: (project: ProjectKey, visible: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            aria-label={`${visibleProjects.length} visible Projects`}
          />
        }
      >
        <FolderKanban />
        <span className="truncate font-medium">Projects</span>
        <span className="text-muted-foreground">{visibleProjects.length}</span>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Visible in Sessions</DropdownMenuLabel>
        {PROJECTS.map((item) => (
          <DropdownMenuItem
            key={item}
            onClick={() => onVisibilityChange(item, !visibleProjects.includes(item))}
          >
            <FolderKanban />
            <span className="flex-1">{item}</span>
            {visibleProjects.includes(item) ? <Check /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus />Open another Project…
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />Manage Projects…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PrototypeChrome({
  visibleProjects,
  onVisibilityChange,
}: {
  visibleProjects: ProjectKey[]
  onVisibilityChange: (project: ProjectKey, visible: boolean) => void
}) {
  return (
    <header className="flex h-11 shrink-0 items-center bg-muted/50 pl-[4.5rem]">
      <ProjectManager
        visibleProjects={visibleProjects}
        onVisibilityChange={onVisibilityChange}
      />
    </header>
  )
}

const RAIL_ITEMS = [
  { label: 'Sessions', icon: <Bot />, active: true },
  { label: 'Tickets', icon: <Ticket />, active: false },
  { label: 'Atlas', icon: <MapIcon />, active: false },
  { label: 'Files', icon: <FolderGit2 />, active: false },
]

function SettingsMenu({ theme, onThemeChange, concierge, onConciergeChange }: { theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void; concierge: ConciergePlacement; onConciergeChange: (placement: ConciergePlacement) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" aria-label="Settings" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground" />}>
        <Settings />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem className="gap-2 py-2">
          <span className="grid size-7 place-items-center rounded-md border border-border/60 bg-background text-[10px] font-semibold">MA</span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">milad</span>
            <span className="block text-[10px] text-muted-foreground">Account settings</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => onThemeChange(value as ThemeMode)}>
          <DropdownMenuRadioItem value="system"><Monitor />System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Concierge</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={concierge} onValueChange={(value) => onConciergeChange(value as ConciergePlacement)}>
          <DropdownMenuRadioItem value="roster">Below Session list</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="floating">Floating companion</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="off">Off</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RosterConcierge({ onFloat }: { onFloat: () => void }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Open Concierge chat"
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted"
          />
        }
      >
        <span className="relative shrink-0">
          <ConciergeOrb compact />
          <span className="absolute -top-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-destructive text-[8px] text-destructive-foreground">2</span>
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-medium">Concierge is listening</span>
          <span className="block truncate text-[10px] text-muted-foreground">“Show every feed state in one conversation…”</span>
        </span>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2 text-xs">
            <ConciergeOrb compact />
            Concierge
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />Global voice chat
            </span>
          </PopoverTitle>
          <PopoverDescription>Available across Projects and Sessions.</PopoverDescription>
        </PopoverHeader>
        <div className="space-y-1 rounded-lg bg-muted/60 p-2 text-[11px] leading-4">
          <p className="text-muted-foreground">You: “Keep the composer fixed and make the feed richer.”</p>
          <p>I’m updating the prototype now.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1">Open chat</Button>
          <Button type="button" variant="outline" size="sm" onClick={onFloat}>Float</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PrototypeRail({ theme, onThemeChange, concierge, onConciergeChange }: { theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void; concierge: ConciergePlacement; onConciergeChange: (placement: ConciergePlacement) => void }) {
  return (
    <nav aria-label="Main navigation" className="flex min-h-0 w-[3.75rem] shrink-0 flex-col items-center bg-muted/50 pb-4 max-md:hidden [&_svg]:size-(--size-icon-control)">
      <div className="flex flex-col gap-3">
        {RAIL_ITEMS.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={item.active ? 'page' : undefined}
                  className={`grid size-9 place-items-center rounded-lg transition-colors ${
                    item.active
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  }`}
                />
              }
            >
              {item.icon}
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <Tooltip>
          <TooltipTrigger render={<button type="button" aria-label="Archive" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground" />}>
            <Archive />
          </TooltipTrigger>
          <TooltipContent side="right">Archive</TooltipContent>
        </Tooltip>
        <SettingsMenu theme={theme} onThemeChange={onThemeChange} concierge={concierge} onConciergeChange={onConciergeChange} />
      </div>
    </nav>
  )
}

const STATUS_STYLES: Record<PrototypeSession['status'], string> = {
  running: 'bg-emerald-500',
  waiting: 'bg-amber-400',
  idle: 'bg-muted-foreground/45',
}

const PULL_REQUEST_STYLES: Record<PrototypeSession['pullRequest']['state'], string> = {
  open: 'text-emerald-600 dark:text-emerald-400',
  draft: '',
  merged: 'text-violet-600 dark:text-violet-400',
}

function SessionRosterRow({ session }: { session: PrototypeSession }) {
  const selected = session.id === 'session-design'
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      className={`group w-full rounded-lg px-2 py-2 text-left transition-colors ${
        selected
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      <span className="flex items-start gap-2">
        <span className="relative flex h-4 shrink-0 items-center">
          <HarnessLogo harness={session.harness} className="size-(--size-icon-inline)" />
          <span
            className={`absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-card ${STATUS_STYLES[session.status]}`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{session.title}</span>
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            {session.activity}
          </span>
          <span className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground [&_svg]:size-(--size-icon-metadata)">
            <span className="inline-flex items-center gap-1">
              <Ticket />#{session.ticket}
            </span>
            <span
              className={`inline-flex items-center gap-1 ${PULL_REQUEST_STYLES[session.pullRequest.state]}`}
            >
              <GitFork />#{session.pullRequest.number} {session.pullRequest.state}
            </span>
            {session.subagents > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Bot />{session.subagents}
              </span>
            ) : null}
            <span className="ml-auto shrink-0 tabular-nums">{session.updated}</span>
          </span>
        </span>
      </span>
    </button>
  )
}

function PrototypeSessionRoster({
  concierge,
  onConciergeChange,
  visibleProjects,
}: {
  concierge: ConciergePlacement
  onConciergeChange: (placement: ConciergePlacement) => void
  visibleProjects: ProjectKey[]
}) {
  const [expandedProjects, setExpandedProjects] = useState<ProjectKey[]>(PROJECTS)

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex h-12 shrink-0 items-center px-3">
        <h1 className="text-sm font-semibold">Sessions</h1>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="New Session">
          <Plus />
        </Button>
      </div>
      <div className="px-3 pt-2 pb-1.5">
        <div className="flex h-7 items-center gap-2 rounded-md border border-border/60 bg-background px-2 text-[11px] text-muted-foreground [&_svg]:size-(--size-icon-inline)">
          <Search />
          <span>Find a Session</span>
          <span className="ml-auto rounded border border-border/60 px-1.5 py-0.5 text-[10px]">⌘K</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {visibleProjects.map((project) => {
          const sessions = PROTOTYPE_SESSIONS.filter((session) => session.project === project)
          const expanded = expandedProjects.includes(project)
          return (
            <section key={project} className="pb-2">
              <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] font-medium text-muted-foreground">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`project-sessions-${project}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-foreground"
                  onClick={() =>
                    setExpandedProjects((current) =>
                      expanded
                        ? current.filter((item) => item !== project)
                        : [...current, project],
                    )
                  }
                >
                  <ChevronRight
                    className={`size-(--size-icon-inline) transition-transform ${expanded ? 'rotate-90' : ''}`}
                  />
                  <FolderKanban className="size-(--size-icon-inline)" />
                  <span className="truncate text-foreground">{project}</span>
                  <span>{sessions.length}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label={`New Session in ${project}`}
                >
                  <Plus />
                </Button>
              </div>
              {expanded ? (
                <div id={`project-sessions-${project}`} className="space-y-1">
                  {sessions.map((session) => (
                    <SessionRosterRow key={session.id} session={session} />
                  ))}
                </div>
              ) : null}
            </section>
          )
        })}
        {visibleProjects.length === 0 ? (
          <p className="px-2 py-6 text-center text-control text-muted-foreground">
            Choose Projects from the top bar to show their Sessions.
          </p>
        ) : null}
      </div>
      {concierge === 'roster' ? (
        <div className="shrink-0 border-t border-border/60 p-2">
          <RosterConcierge onFloat={() => onConciergeChange('floating')} />
        </div>
      ) : null}
    </aside>
  )
}

function HeaderSignal({ icon, label, value, tone = '' }: { icon: ReactNode; label: string; value: string; tone?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5">
      <span className="text-muted-foreground [&_svg]:size-(--size-icon-inline)">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[9px] leading-none text-muted-foreground">{label}</span>
        <span className={`mt-1 block truncate text-[10px] leading-none font-medium ${tone}`}>{value}</span>
      </span>
    </span>
  )
}

function PrototypeSessionHeader({ showSidebar, onToggleSidebar }: { showSidebar: boolean; onToggleSidebar: () => void }) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-medium">Continue Session design from composer</h2>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Running
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
          <GitBranch />
          <span className="truncate">argo/#1258-composer-prototype</span>
          <span>·</span>
          <a
            href="https://github.com/milad-alizadeh/argo/issues/1258"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 hover:text-foreground hover:underline"
          >
            <Ticket />#1258
          </a>
        </div>
      </div>
      <div className="ml-auto hidden shrink-0 divide-x divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-muted/30 xl:flex">
        <HeaderSignal icon={<GitFork />} label="Pull request" value="#1931 · Draft" tone="text-violet-600 dark:text-violet-400" />
        <HeaderSignal icon={<Check />} label="Implementation" value="Ready for PR" tone="text-emerald-600 dark:text-emerald-400" />
        <HeaderSignal icon={<FileCheck2 />} label="Code review" value="Not reviewed" tone="text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant={showSidebar ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Toggle Session sidebar" onClick={onToggleSidebar}>
          <PanelRight />
        </Button>
      </div>
    </header>
  )
}

function SessionWorkSidebar({
  evidence,
  onActiveEvidenceChange,
  onCloseEvidence,
}: {
  evidence: FeedPrototypeEvidence | null
  onActiveEvidenceChange: (evidenceId: string) => void
  onCloseEvidence: () => void
}) {
  if (evidence)
    return (
      <FeedEvidencePrototype
        evidence={evidence}
        onActiveEvidenceChange={onActiveEvidenceChange}
        onClose={onCloseEvidence}
      />
    )
  return (
    <aside className="h-full w-full overflow-y-auto bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold">Running under this Session</h3>
        <span className="text-[10px] text-muted-foreground">4 live</span>
      </div>
      <div className="space-y-1">
        {['Design feed variations', 'Audit macOS feed states', 'Map shadcn components'].map((label, index) => (
          <button key={label} type="button" className="flex w-full items-start gap-2 rounded-lg p-2 text-left hover:bg-muted">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium">{label}</span>
              <span className="block text-[10px] text-muted-foreground">Subagent {index + 1} · running</span>
            </span>
          </button>
        ))}
      </div>
      <div className="my-3 h-px bg-border/60" />
      <h3 className="mb-2 text-xs font-semibold">Shell · 1</h3>
      <button type="button" className="flex w-full items-start gap-2 rounded-lg bg-muted/60 p-2 text-left">
        <CircleDot className="mt-0.5 text-emerald-500" />
        <span className="min-w-0">
          <span className="block truncate font-mono text-[10px]">bun run dev</span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">Vite · port 5191</span>
        </span>
      </button>
      <button type="button" className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
        <ChevronDown /> 6 finished
      </button>
    </aside>
  )
}

function FloatingConcierge({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-5 bottom-5 z-40 flex items-end gap-2">
      <div className="max-w-72 rounded-xl border border-border/60 bg-popover p-3 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-medium">Concierge <span className="size-1.5 rounded-full bg-emerald-500" /></div>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">You: “Keep the composer fixed and make the feed richer.”</p>
        <p className="mt-1 text-[11px] leading-4">I’m updating the prototype now.</p>
      </div>
      <button type="button" aria-label="Open Concierge" className="relative rounded-full border border-border/60 bg-background p-1 shadow-xl">
        <ConciergeOrb />
        <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] text-destructive-foreground">2</span>
      </button>
      <button type="button" aria-label="Disable floating Concierge" onClick={onClose} className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground shadow"><X /></button>
    </div>
  )
}

function contextPercentage(state: ComposerState) {
  return { smart: 14, warning: 30, dumb: 74 }[state.contextPreview]
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
          <DropdownMenuItem onClick={() => add('workspace.jpg')}>
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
        render={<InputGroupButton variant="ghost" className="max-w-80 text-xs font-medium text-foreground" aria-label="Choose run setup" />}
      >
        <IconLabel icon={<HarnessLogo harness={state.harness} className="size-3.5" />}>
          <span className="inline-flex items-center gap-1.5">
            {definition.label}
            <span className="text-muted-foreground">·</span>
            {state.model}
            <span className="text-muted-foreground">·</span>
            {state.effort}
          </span>
        </IconLabel>
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
                  <IconLabel icon={<HarnessLogo harness={harness} className="size-3.5" />}>{HARNESSES[harness].label}</IconLabel>
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
              style={{
                background: `linear-gradient(to right, var(--foreground) 0%, var(--foreground) ${(effortIndex / Math.max(1, definition.efforts.length - 1)) * 100}%, var(--muted) ${(effortIndex / Math.max(1, definition.efforts.length - 1)) * 100}%, var(--muted) 100%)`,
              }}
              className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full border-0 outline-none [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-foreground"
            />
            <div className="relative mt-2 h-4 text-[10px] text-muted-foreground">
              {definition.efforts.map((effort, index) => (
                <span
                  key={effort}
                  className={`absolute whitespace-nowrap ${state.effort === effort ? 'font-semibold text-foreground' : ''}`}
                  style={{
                    left: `${(index / Math.max(1, definition.efforts.length - 1)) * 100}%`,
                    transform: index === 0 ? 'none' : index === definition.efforts.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {effort}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const PERMISSION_ICONS: Record<HarnessKey, (typeof ShieldCheck)[]> = {
  codex: [CircleHelp, ShieldCheck, Unlock],
  claude: [WandSparkles, Hand, FileCheck2, ListTodo, ShieldAlert],
}

function PermissionIcon({ harness, permission, className }: { harness: HarnessKey; permission: string; className?: string }) {
  const permissionIndex = HARNESSES[harness].permissions.findIndex((item) => item.label === permission)
  const Icon = PERMISSION_ICONS[harness][permissionIndex] ?? ShieldCheck
  return <Icon className={className} />
}

function PermissionMenu({ state, setState }: StateProps) {
  const definition = HARNESSES[state.harness]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<InputGroupButton variant="ghost" className="text-xs font-medium text-foreground" aria-label="Choose permission mode" />}
      >
        <IconLabel icon={<PermissionIcon harness={state.harness} permission={state.permission} />}>{state.permission}</IconLabel>
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-[23rem] p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">{definition.label} permissions</DropdownMenuLabel>
          {definition.permissions.map((permission) => (
            <DropdownMenuItem
              key={permission.label}
              className="items-start rounded-md px-2 py-1.5"
              onClick={() => setState({ ...state, permission: permission.label })}
            >
              <PermissionIcon harness={state.harness} permission={permission.label} className="mt-0.5 size-3.5" />
              <span className="grid gap-0.5">
                <span className="text-[13px] font-medium">{permission.label}</span>
                <span className="text-[11px] leading-4 text-muted-foreground">{permission.detail}</span>
              </span>
              <SelectionMark active={state.permission === permission.label} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function fileType(reference: string) {
  const separator = reference.lastIndexOf('.')
  if (separator < 1 || separator === reference.length - 1) return 'File'
  return `${reference.slice(separator + 1).toUpperCase()} file`
}

function fileTitle(reference: string) {
  const name = reference.split('/').at(-1) ?? reference
  const separator = name.lastIndexOf('.')
  return separator > 0 ? name.slice(0, separator) : name
}

function imageSource(reference: string) {
  return reference === 'workspace.jpg' ? '/prototype-assets/workspace.jpg' : `/${reference}`
}

function initialAttachments() {
  if (new URLSearchParams(window.location.search).get('test') !== 'attachments-10') {
    return ['workspace.jpg', 'ComposerPrototype.tsx']
  }
  return ['workspace.jpg', 'ComposerPrototype.tsx', 'queue.ts', 'context.tsx', 'permissions.ts', 'models.json', 'notes.md', 'layout.css', 'tokens.ts', 'README.md']
}

function ReferenceStrip({ state, setState }: StateProps) {
  const [renderedAttachments, setRenderedAttachments] = useState(() => state.attachments.filter((reference) => !reference.startsWith('$')))
  const [expanded, setExpanded] = useState(renderedAttachments.length > 0)

  useEffect(() => {
    let frame = 0
    let timeout = 0
    const attachments = state.attachments.filter((reference) => !reference.startsWith('$'))
    if (attachments.length > 0) {
      setRenderedAttachments(attachments)
      frame = window.requestAnimationFrame(() => setExpanded(true))
    } else {
      setExpanded(false)
      timeout = window.setTimeout(() => setRenderedAttachments([]), 280)
    }
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [state.attachments])

  return (
    <div className={`w-full overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] will-change-[height] ${expanded ? 'h-[4.5rem]' : 'h-0'}`}>
      <div>
        <AttachmentGroup className="w-[42rem] max-w-[calc(100%-9rem)] flex-nowrap overflow-x-auto select-none px-4 py-1">
          {renderedAttachments.map((reference) => {
            const remove = () =>
              setState({
                ...state,
                attachments: state.attachments.filter((item) => item !== reference),
              })

            const isImage = /\.(avif|gif|jpe?g|png|webp)$/i.test(reference)
            return (
              <Attachment key={reference} className="relative h-16 w-fit min-w-40 max-w-56 shrink-0 items-start select-none border-border/60 py-1 pr-9 pl-2" size="xs">
                <AttachmentMedia className="relative !size-14 overflow-hidden rounded-lg bg-muted">
                  {isImage ? (
                    <img alt="" className="absolute inset-0 !size-full object-cover" src={imageSource(reference)} />
                  ) : (
                    <File className="size-6" />
                  )}
                </AttachmentMedia>
                <AttachmentContent className="!min-w-0 !max-w-28 self-start overflow-hidden pr-6">
                  <AttachmentTitle className="!block !max-w-24 !overflow-hidden !text-ellipsis !whitespace-nowrap">{fileTitle(reference)}</AttachmentTitle>
                  <AttachmentDescription>{fileType(reference)}</AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions className="absolute top-0 right-0">
                  <AttachmentAction aria-label={`Remove ${reference}`} onClick={remove}>
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            )
          })}
        </AttachmentGroup>
      </div>
    </div>
  )
}

function ComposerAutocomplete({ draft, onSelect }: { draft: string; onSelect: (value: string) => void }) {
  const suggestions = composerSuggestions(draft)
  if (suggestions.length === 0) return null
  const isCommand = draft.match(/(^|\s)\/[^\s]*$/)
  return (
    <div className="absolute bottom-full left-0 z-40 mb-2 w-[30rem] overflow-hidden rounded-xl border bg-background shadow-xl">
      <div className="flex items-center border-b px-3 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">{isCommand ? 'Skills and commands' : 'Files, folders, and skills'}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Enter to insert</span>
      </div>
      <div className="p-1.5">
        {suggestions.map((suggestion, index) => {
          const SuggestionIcon = suggestion.kind === 'file' ? File : suggestion.kind === 'folder' ? Folder : suggestion.kind === 'command' ? Command : WandSparkles
          return (
            <button
              key={suggestion.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(insertComposerSuggestion(draft, suggestion))}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${index === 0 ? 'bg-muted' : 'hover:bg-muted/70'}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background"><SuggestionIcon className="size-3.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs font-medium">
                  {suggestion.label}
                  {suggestion.frequent ? <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-medium text-background">Most used</span> : null}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{suggestion.detail}</span>
              </span>
              <span className="text-[10px] capitalize text-muted-foreground">{suggestion.kind}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ContextPopover({
  state,
  appearance = 'compact',
  meterStyle = 'solid',
}: {
  state: ComposerState
  appearance?: 'compact' | 'details'
  meterStyle?: 'solid' | 'gradient' | 'grayscale'
}) {
  const context = HARNESSES[state.harness].context
  const [autoCompactThresholdTokens, setAutoCompactThresholdTokens] = useState(Math.round(context.total * 0.8))
  const [autoCompactThresholdInput, setAutoCompactThresholdInput] = useState(String(Math.round(context.total * 0.8)))
  const percentage = contextPercentage(state)
  const smartZonePercentage = 20
  const smartZoneTokens = Math.round(context.total * smartZonePercentage / 100)
  const autoCompactThresholdPercentage = Math.round(autoCompactThresholdTokens / context.total * 100)
  const formatTokenCount = (tokens: number) => `${Math.round(tokens / 1000)}k tokens`
  const zone = contextZone(percentage)
  const contextStatus = zone.label
  const used = Math.round(context.total * percentage / 100)
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
            <Layers3 className="size-4" />
            <span className="text-xs font-semibold">{contextStatus}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{percentage}%</span>
          </>
        ) : <Info className="size-4" />}
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[28rem] gap-4 p-4">
        {meterStyle !== 'solid' ? (
          <>
            <PopoverHeader>
              <PopoverTitle className="flex items-center gap-2">
                What is the context window?
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${zone.badge}`}>{contextStatus}</span>
              </PopoverTitle>
              <PopoverDescription>
                Everything the model can consider for its next response: instructions, tools, files, and conversation. As it fills, relevant details compete with old context.
              </PopoverDescription>
            </PopoverHeader>
            <div className="border-y py-4">
              <div className={`h-1.5 rounded-full ${meterStyle === 'grayscale' ? 'bg-gradient-to-r from-neutral-300 via-neutral-500 to-neutral-900' : 'bg-[linear-gradient(90deg,var(--color-emerald-500)_0%,var(--color-amber-400)_20%,var(--color-red-500)_40%,var(--color-red-500)_100%)]'}`} />
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-3">
                <div>
                  <div className="text-xs font-semibold">Smart Zone · {smartZonePercentage}% · {formatTokenCount(smartZoneTokens)}</div>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">Focused context. Instructions and recent decisions remain easy to weigh.</p>
                </div>
                <ArrowRight className="mt-1 size-4 text-muted-foreground" />
                <div className="text-right">
                  <div className="text-xs font-semibold">Dumb Zone</div>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">History still fits, but noise and stale decisions weaken attention.</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] leading-4 text-muted-foreground">
              “Smart Zone” and “Dumb Zone” are context-engineering shorthand associated with Dex Horthy and documented by Matt Pocock. Our {smartZonePercentage}% · {formatTokenCount(smartZoneTokens)} boundary is a working target, not a model guarantee.
            </p>
          </>
        ) : (
          <>
            <PopoverHeader>
              <PopoverTitle className="flex items-center gap-2">
                Context health
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${zone.badge}`}>{contextStatus}</span>
              </PopoverTitle>
              <PopoverDescription>Current context compared with the working smart-zone target.</PopoverDescription>
            </PopoverHeader>
            <div className="rounded-xl border p-3">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Active context</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">
                    {(used / 1000).toFixed(0)}k <span className="text-sm font-normal text-muted-foreground">/ {(context.total / 1000).toFixed(0)}k</span>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-medium">Smart Zone ~{smartZonePercentage}% · {formatTokenCount(smartZoneTokens)}</div>
                  <div className="text-muted-foreground">Current · {percentage}% · {formatTokenCount(used)}</div>
                </div>
              </div>
              <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-muted">
                <div className={`absolute inset-y-0 left-0 ${zone.fill}`} style={{ width: `${percentage}%` }} />
                <div className="absolute inset-y-[-3px] w-0.5 bg-foreground" style={{ left: `${smartZonePercentage}%` }} />
              </div>
              <p className="mt-2 text-xs leading-4 text-muted-foreground">
                This session is in the {contextStatus}. Compact or hand off before starting another substantial phase.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />Smart · 0–20% · 0–{formatTokenCount(smartZoneTokens)}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />Nearing dumb · 20–40% · {formatTokenCount(smartZoneTokens)}–{formatTokenCount(context.total * 0.4)}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" />Dumb · 40%+ · {formatTokenCount(context.total * 0.4)}+</span>
            </div>
            <p className="text-[10px] leading-4 text-muted-foreground">The 20% boundary is a workflow target, not a model guarantee.</p>
          </>
        )}
        {state.harness === 'claude' ? (
          <div className="grid gap-2 border-t pt-4">
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
        <div className="grid gap-3 border-t pt-4">
          <div>
            <div className="text-xs font-semibold">Auto-compact</div>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">
              Compact when the context reaches the threshold. Total context: {formatTokenCount(context.total)}.
            </p>
          </div>
          <input
            type="range"
            min="40"
            max="95"
            step="5"
            value={autoCompactThresholdPercentage}
            onChange={(event) => {
              const tokens = Math.round(context.total * Number(event.target.value) / 100)
              setAutoCompactThresholdTokens(tokens)
              setAutoCompactThresholdInput(String(tokens))
            }}
            aria-label="Auto-compact threshold"
            className="h-1.5 w-full cursor-pointer accent-foreground"
          />
          <div className="flex items-end">
            <label className="grid w-1/2 gap-1 text-[10px] text-muted-foreground">
              <span className="flex justify-between">
                <span>Compact at</span>
                <span>{autoCompactThresholdPercentage}% of total</span>
              </span>
              <span className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs text-foreground">
                <input
                  type="number"
                  min={Math.round(context.total * 0.4)}
                  max={Math.round(context.total * 0.95)}
                  step="1000"
                  value={autoCompactThresholdInput}
                  onChange={(event) => setAutoCompactThresholdInput(event.target.value)}
                  onBlur={() => {
                    const tokens = Math.min(Math.round(context.total * 0.95), Math.max(Math.round(context.total * 0.4), Number(autoCompactThresholdInput) || autoCompactThresholdTokens))
                    setAutoCompactThresholdTokens(tokens)
                    setAutoCompactThresholdInput(String(tokens))
                  }}
                  className="min-w-0 flex-1 bg-transparent tabular-nums outline-none"
                />
                <span className="shrink-0 text-muted-foreground">tokens</span>
              </span>
            </label>
          </div>
        </div>
        {meterStyle === 'solid' && percentage >= 70 && appearance === 'compact' ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Compact this task before the next large change.</p>
            <div className="ml-auto flex shrink-0 gap-2">
              <Button size="sm"><Minimize2 />Compact</Button>
              <Button variant="outline" size="sm"><GitFork />Handoff</Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

function ContextSurface({
  state,
  layout,
}: {
  state: ComposerState
  layout: 'inline' | 'dock' | 'footer' | 'attached'
}) {
  const context = HARNESSES[state.harness].context
  const percentage = contextPercentage(state)
  const used = `${(context.total * percentage / 100 / 1000).toFixed(0)}k`
  const zone = contextZone(percentage)
  const status = zone.label
  const contextAlert = state.contextPreview === 'dumb'

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
          <Button variant="secondary" size="sm"><Minimize2 />Compact</Button>
          <Button variant="outline" size="sm"><GitFork />Handoff</Button>
        </div>
      </div>
    )
  }

  if (layout === 'attached') {
    return (
      <div className="flex select-none items-center gap-3 rounded-b-xl border bg-background px-4 pb-2 pt-4 shadow-lg shadow-foreground/10">
        <div className="shrink-0 border-r border-border/60 pr-4"><UsagePopover state={state} /></div>
        <IconLabel icon={<Layers3 />} className={contextAlert ? 'text-red-600' : 'text-foreground'}>Context</IconLabel>
        <TooltipProvider>
        <div className="relative min-w-28 flex-1">
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div className={`absolute inset-y-0 left-0 rounded-full ${contextAlert ? 'bg-gradient-to-r from-white to-red-500' : 'bg-gradient-to-r from-neutral-300 via-neutral-500 to-neutral-900'}`} style={{ width: `${percentage}%` }} />
            <div className="absolute inset-y-[-2px] w-0.5 bg-foreground" style={{ left: '20%' }} />
            <Tooltip>
              <TooltipTrigger render={<button type="button" className="absolute inset-y-0 left-0 w-1/5" aria-label="About the Smart Zone" />} />
              <TooltipContent className="max-w-none whitespace-nowrap">Smart · focused context</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<button type="button" className="absolute inset-y-0 right-0 w-4/5" aria-label="About the Dumb Zone" />} />
              <TooltipContent className="max-w-none whitespace-nowrap">Dumb · attention can weaken</TooltipContent>
            </Tooltip>
          </div>
        </div>
        </TooltipProvider>
        <div className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
          <span className="font-medium text-foreground">{used}</span>
          <span className="text-muted-foreground"> / 200k</span>
          <span className="font-medium">· {percentage}%</span>
          <ContextPopover state={state} appearance="details" meterStyle="grayscale" />
        </div>
        <div className="ml-1 flex shrink-0 items-center gap-1 border-l border-border/60 pl-4">
          <Button variant="secondary" size="sm"><IconLabel icon={<Minimize2 />}>Compact</IconLabel></Button>
          <Button variant="outline" size="sm"><IconLabel icon={<GitFork />}>Handoff</IconLabel></Button>
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
          <Button variant="secondary" size="sm" className="px-2"><Minimize2 />Compact</Button>
          <Button variant="outline" size="sm" className="px-2"><GitFork />Handoff</Button>
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
        <Button variant="secondary" size="sm"><Minimize2 />Compact</Button>
        <Button variant="outline" size="sm"><GitFork />Handoff</Button>
      </div>
    </div>
  )
}

function AnimatedHeight({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-4xl">
      <div className="relative z-10 rounded-2xl [&>*]:!border-border/60 [&_button]:!font-normal [&_span]:!font-normal">
        {children}
      </div>
    </div>
  )
}

function QueuePreview({
  messages,
  layout,
  onSteer,
  onRemove,
  onEdit,
  onReorder,
  latestQueuedId,
  isAdding,
}: {
  messages: QueuedMessage[]
  layout: 'attached' | 'inline' | 'floating' | 'integrated' | 'attached-stack'
  onSteer: (message: QueuedMessage) => void
  onRemove: (id: string) => void
  onEdit: (message: QueuedMessage) => void
  onReorder: (sourceId: string, targetId: string) => void
  latestQueuedId?: string | null
  isAdding?: boolean
}) {
  const [exitingMessageId, setExitingMessageId] = useState<string | null>(null)
  const animatePop = (queuedMessage: QueuedMessage, action: () => void) => {
    if (exitingMessageId) return
    setExitingMessageId(queuedMessage.id)
    window.setTimeout(() => {
      action()
      setExitingMessageId(null)
    }, 280)
  }
  const message = messages[0]
  if (!message) return null
  const stacked = layout === 'integrated' || layout === 'floating' || layout === 'attached-stack'
  if (stacked) {
    const shell = {
      integrated: 'border-b bg-background',
      floating: 'mb-2 ml-auto w-3/4 overflow-hidden rounded-lg border bg-background shadow-sm',
      'attached-stack': 'relative z-0 mx-auto -mb-2 w-[calc(100%-0.5rem)] overflow-hidden rounded-t-xl border bg-background pb-2 shadow-lg shadow-foreground/10',
      attached: '',
      inline: '',
    }[layout]
    return (
      <div className={shell}>
        <div className="divide-y divide-border/60">
        {messages.map((queuedMessage) => (
          <div
            key={queuedMessage.id}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', queuedMessage.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onReorder(event.dataTransfer.getData('text/plain'), queuedMessage.id)}
            className={`flex h-11 cursor-grab items-center gap-2 overflow-hidden px-4 active:cursor-grabbing ${exitingMessageId === queuedMessage.id ? 'composer-queue-exit' : isAdding ? queuedMessage.id === latestQueuedId ? 'composer-queue-enter' : 'composer-queue-lift' : ''}`}
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs">{queuedMessage.text}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => animatePop(queuedMessage, () => onSteer(queuedMessage))}>
              <IconLabel icon={<Route />}>Steer</IconLabel>
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove queued message: ${queuedMessage.text}`} onClick={() => animatePop(queuedMessage, () => onRemove(queuedMessage.id))}>
              <Trash2 className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit queued message: ${queuedMessage.text}`} onClick={() => onEdit(queuedMessage)}>
              <Pencil className="size-3.5" />
            </Button>
          </div>
        ))}
        </div>
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
        <IconLabel icon={<Route />}>Steer</IconLabel>
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove queued message" onClick={() => onRemove(message.id)}>
        <Trash2 className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit queued message" onClick={() => onEdit(message)}><Pencil className="size-3.5" /></Button>
    </div>
  )
}

function TaskPlanPopover() {
  const steps = [
    { label: 'Map composer information', status: 'done' },
    { label: 'Choose the base layout', status: 'done' },
    { label: 'Polish context and queue states', status: 'current' },
    { label: 'Review compact widths', status: 'upcoming' },
    { label: 'Prepare implementation handoff', status: 'upcoming' },
  ] as const
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-full bg-background/90 px-2.5 text-xs font-medium shadow-[0_2px_6px_-3px_rgba(0,0,0,0.16)]" aria-label="Open task plan" />}>
        <IconLabel icon={(
          <svg viewBox="0 0 20 20" className="-rotate-90" aria-hidden="true">
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray="60 100" />
          </svg>
        )}>Step 3/5</IconLabel>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle>Step 3/5</PopoverTitle>
        </PopoverHeader>
        <Progress value={60} className="h-1.5" />
        <div className="grid gap-1">
          {steps.map((step, index) => (
            <div key={step.label} className={`flex items-center gap-2 overflow-visible rounded-md px-2 py-1.5 text-xs ${step.status === 'current' ? 'bg-muted font-medium' : ''}`}>
              <span className={`relative flex size-5 shrink-0 items-center justify-center overflow-visible rounded-full text-[10px] ${step.status === 'done' ? 'bg-foreground text-background' : step.status === 'current' ? 'border border-foreground' : 'border text-muted-foreground'}`}>
                {step.status === 'current' ? <span className="absolute inset-0 animate-ping rounded-full border border-foreground/40" /> : null}
                {step.status === 'done' ? <Check className="size-3" /> : index + 1}
              </span>
              <span className={step.status === 'upcoming' ? 'text-muted-foreground' : ''}>{step.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function UsagePopover({ state }: { state: ComposerState }) {
  const definition = HARNESSES[state.harness]
  const primaryUsage = definition.usage.reduce((highest, item) => item.percentage > highest.percentage ? item : highest)
  const primaryUsagePercentage = state.usagePreview === 'high' ? 94 : primaryUsage.percentage
  const usageAlert = primaryUsagePercentage >= 90
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className={`gap-1.5 px-2 text-xs font-medium ${usageAlert ? 'text-red-600' : 'text-foreground'}`} />}>
        <IconLabel icon={<CircleGauge />}>
          Usage <span className={`tabular-nums ${usageAlert ? 'text-red-600' : 'text-muted-foreground'}`}>{primaryUsagePercentage}%</span>
        </IconLabel>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>{definition.label} plan usage</PopoverTitle>
          <PopoverDescription>Account allowance, separate from context health</PopoverDescription>
        </PopoverHeader>
        {definition.usage.map((item) => {
          const percentage = item === primaryUsage ? primaryUsagePercentage : item.percentage
          return (
            <div key={item.label} className="grid gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>
                <span className="w-8 text-right text-xs tabular-nums">{percentage}%</span>
              </div>
              <Progress value={percentage} />
            </div>
          )
        })}
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

function Transcript({
  messages,
  activeEvidenceId,
  onOpenEvidence,
}: {
  messages: MessageRow[]
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: FeedPrototypeEvidence) => void
}) {
  return (
    <MessageScrollerProvider defaultScrollPosition="end">
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-3xl px-8 py-10">
            <SessionFeedPrototype
              onOpenEvidence={onOpenEvidence}
              activeEvidenceId={activeEvidenceId}
            />
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

function initialTheme(): ThemeMode {
  const theme = new URLSearchParams(window.location.search).get('theme')
  return theme === 'light' || theme === 'dark' ? theme : 'system'
}

function initialConcierge(): ConciergePlacement {
  const concierge = new URLSearchParams(window.location.search).get('concierge')
  return concierge === 'floating' || concierge === 'off' ? concierge : 'roster'
}

export function ComposerPrototype() {
  const [visibleProjects, setVisibleProjects] = useState<ProjectKey[]>(PROJECTS)
  const [theme, setTheme] = useState<ThemeMode>(initialTheme)
  const [concierge, setConcierge] = useState<ConciergePlacement>(initialConcierge)
  const [showSessionSidebar, setShowSessionSidebar] = useState(true)
  const [state, setState] = useState<ComposerState>({
    harness: 'codex',
    model: HARNESSES.codex.models[0] ?? '',
    effort: HARNESSES.codex.efforts[1] ?? '',
    permission: HARNESSES.codex.permissions[2]?.label ?? '',
    attachments: initialAttachments(),
    contextPreview: 'dumb',
    usagePreview: 'normal',
  })
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [feedEvidence, setFeedEvidence] = useState<FeedPrototypeEvidence | null>(null)
  const [activeFeedEvidenceId, setActiveFeedEvidenceId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([
    { id: 'queued-1', text: 'Update the empty state, then verify the composer at compact widths.' },
    { id: 'queued-2', text: 'Capture the selected direction for implementation.' },
  ])
  const [latestQueuedId, setLatestQueuedId] = useState<string | null>(null)
  const [isQueueAnimating, setIsQueueAnimating] = useState(false)

  const openFeedEvidence = useCallback((evidence: FeedPrototypeEvidence) => {
    setFeedEvidence({ ...evidence })
    setActiveFeedEvidenceId(evidence.id)
    setShowSessionSidebar(true)
  }, [])

  useEffect(() => {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && systemDark))
  }, [theme])

  const steerQueuedMessage = (message: QueuedMessage) => {
    setDraft(message.text)
    setQueuedMessages(queuedMessages.filter((item) => item.id !== message.id))
  }
  const removeQueuedMessage = (id: string) => {
    setQueuedMessages(queuedMessages.filter((item) => item.id !== id))
  }
  const editQueuedMessage = (message: QueuedMessage) => {
    setDraft(message.text)
  }
  const reorderQueuedMessage = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const sourceIndex = queuedMessages.findIndex((item) => item.id === sourceId)
    const targetIndex = queuedMessages.findIndex((item) => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const nextMessages = [...queuedMessages]
    const sourceMessage = nextMessages[sourceIndex]
    const targetMessage = nextMessages[targetIndex]
    if (!sourceMessage || !targetMessage) return
    nextMessages[sourceIndex] = targetMessage
    nextMessages[targetIndex] = sourceMessage
    setQueuedMessages(nextMessages)
  }

  const send = () => {
    const text = draft.trim()
    if (!text) return
    if (queuedMessages.length > 0) {
      const queuedMessage = { id: `queued-${Date.now()}`, text }
      setQueuedMessages([...queuedMessages, queuedMessage])
      setLatestQueuedId(queuedMessage.id)
      setIsQueueAnimating(true)
      window.setTimeout(() => setIsQueueAnimating(false), 340)
      setDraft('')
      return
    }
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
    <div className="h-dvh min-h-0 overflow-hidden bg-muted/50">
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/50">
        <PrototypeChrome
          visibleProjects={visibleProjects}
          onVisibilityChange={(project, visible) =>
            setVisibleProjects((current) =>
              visible
                ? [...new Set([...current, project])]
                : current.filter((item) => item !== project),
            )
          }
        />
      <div className="flex min-h-0 flex-1">
        <PrototypeRail theme={theme} onThemeChange={setTheme} concierge={concierge} onConciergeChange={setConcierge} />
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-tl-xl border-t border-l border-border/70 bg-background"
        >
        <ResizablePanel
          id="session-roster"
          defaultSize={280}
          minSize={224}
          maxSize={400}
          groupResizeBehavior="preserve-pixel-size"
          className="h-full min-h-0 overflow-hidden"
        >
          <PrototypeSessionRoster
            concierge={concierge}
            onConciergeChange={setConcierge}
            visibleProjects={visibleProjects}
          />
        </ResizablePanel>
        <ResizableHandle className="z-30" />
        <ResizablePanel id="session-workspace" minSize={560} className="h-full min-h-0 overflow-hidden">
        <main
          className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
          data-prototype="composer"
          onPointerDownCapture={() => setKeyboardFocus(false)}
          onKeyDownCapture={(event) => {
            if (event.key === 'Tab') setKeyboardFocus(true)
          }}
        >
          <style>{`
        main svg,
        main img {
          inline-size: 1rem !important;
          block-size: 1rem !important;
          flex: none;
        }
        @keyframes composer-queue-enter {
          from { height: 0; }
          to { height: 44px; }
        }
        @keyframes composer-queue-exit {
          from { height: 44px; }
          to { height: 0; }
        }
        .composer-queue-enter { animation: composer-queue-enter 320ms cubic-bezier(.2,.8,.2,1) both; }
        .composer-queue-exit { animation: composer-queue-exit 280ms cubic-bezier(.4,0,.2,1) both; }
        .composer-queue-enter,
        .composer-queue-lift,
        .composer-queue-exit {
          position: relative;
          background: var(--background);
        }
        .composer-queue-stack [draggable='true'] { position: relative; z-index: 1; }
        .composer-queue-stack [draggable='true']:nth-child(1) { z-index: 10; }
        .composer-queue-stack [draggable='true']:nth-child(2) { z-index: 9; }
        .composer-queue-stack [draggable='true']:nth-child(3) { z-index: 8; }
        .composer-queue-stack [draggable='true']:nth-child(4) { z-index: 7; }
        .composer-queue-stack [draggable='true']:nth-child(5) { z-index: 6; }
          `}</style>
          <PrototypeSessionHeader showSidebar={showSessionSidebar} onToggleSidebar={() => setShowSessionSidebar((visible) => !visible)} />
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel
            id="session-conversation"
            minSize={480}
            className="flex h-full min-h-0 overflow-hidden"
          >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Transcript
              messages={messages}
              activeEvidenceId={activeFeedEvidenceId}
              onOpenEvidence={openFeedEvidence}
            />
          </div>
          <div className="relative shrink-0 bg-gradient-to-t from-background via-background to-transparent px-6 pt-6 pb-8">
            <div className="mx-auto mb-2 w-full max-w-4xl">
              <FeedPermission />
            </div>
            <div className="composer-queue-stack mx-auto w-[calc(100%-1.5rem)] max-w-[calc(56rem-1.5rem)] [&>*]:!border-border/60 [&>*]:!shadow-[0_10px_32px_-16px_rgba(0,0,0,0.3)] [&_button]:!font-normal [&_span]:!font-normal [&_svg]:!size-4">
          <QueuePreview messages={queuedMessages} layout="attached-stack" onSteer={steerQueuedMessage} onRemove={removeQueuedMessage} onEdit={editQueuedMessage} onReorder={reorderQueuedMessage} latestQueuedId={latestQueuedId} isAdding={isQueueAnimating} />
            </div>
            <AnimatedHeight>
              <form
                className="relative z-10 mx-auto w-full max-w-4xl [&>*]:!border-border/60 [&>*]:!shadow-[0_10px_32px_-16px_rgba(0,0,0,0.3)] [&>*]:focus-within:!border-border/60 [&>*]:focus-within:!outline-none [&>*]:focus-within:!ring-0 [&_textarea]:focus:!outline-none [&_textarea]:focus-visible:!outline-none [&_textarea]:focus-visible:!ring-0"
                onSubmit={(event) => {
                  event.preventDefault()
                  send()
                }}
              >
          <ComposerAutocomplete draft={draft} onSelect={setDraft} />
          <InputGroup className={`relative z-20 overflow-hidden rounded-xl border bg-background shadow-xl shadow-foreground/10 focus-within:!border-border focus-within:!ring-0 ${keyboardFocus ? '[&:has(textarea:focus)]:!border-ring [&:has(textarea:focus)]:!ring-[3px] [&:has(textarea:focus)]:!ring-ring/50' : ''}`}>
            <div className="absolute top-4 right-4 z-20"><TaskPlanPopover /></div>
            <ReferenceStrip state={state} setState={setState} />
            <div className="flex min-h-20 items-start px-4 py-3 pr-28">
              <InputGroupTextarea
                aria-label="Message"
                placeholder="Direct the next move…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="!min-h-0 flex-1 !px-0 !py-0 text-sm leading-6 selection:bg-muted-foreground/25 selection:text-foreground"
                onKeyDown={(event) => {
                  const suggestions = composerSuggestions(draft)
                  if (event.key === 'Enter' && !event.shiftKey && suggestions[0]) {
                    event.preventDefault()
                    setDraft(insertComposerSuggestion(draft, suggestions[0]))
                    return
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
              />
            </div>
            <InputGroupAddon align="block-end" className="gap-2 bg-background px-4 py-2">
              <AddContextMenu state={state} setState={setState} />
              <RunSetupMenu state={state} setState={setState} />
              <div className="ml-auto flex items-center gap-1">
                <PermissionMenu state={state} setState={setState} />
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
                  aria-disabled={draft.trim().length === 0}
                  className={`rounded-full ${draft.trim().length === 0 ? 'opacity-50' : ''}`}
                >
                  <ArrowUp />
                </InputGroupButton>
              </div>
            </InputGroupAddon>
          </InputGroup>
              </form>
            </AnimatedHeight>
            <div className="relative z-0 mx-auto -mt-2 w-[calc(100%-1.5rem)] max-w-[calc(56rem-1.5rem)] [&>*]:!border-border/60 [&>*]:!px-4 [&>*]:!shadow-[0_10px_32px_-16px_rgba(0,0,0,0.3)] [&_button]:!font-normal [&_span]:!font-normal [&_svg]:!size-4">
              <ContextSurface state={state} layout="attached" />
            </div>
          </div>
          </div>
          </ResizablePanel>
          {showSessionSidebar ? (
            <>
              <ResizableHandle className="z-30" />
              <ResizablePanel
                id="session-inspector"
                defaultSize={248}
                minSize={216}
                maxSize={400}
                groupResizeBehavior="preserve-pixel-size"
                className="h-full min-h-0 overflow-hidden"
              >
                <SessionWorkSidebar
                  evidence={feedEvidence}
                  onActiveEvidenceChange={setActiveFeedEvidenceId}
                  onCloseEvidence={() => {
                    setFeedEvidence(null)
                    setActiveFeedEvidenceId(null)
                  }}
                />
              </ResizablePanel>
            </>
          ) : null}
          </ResizablePanelGroup>
          {concierge === 'floating' ? <FloatingConcierge onClose={() => setConcierge('off')} /> : null}
        </main>
        </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      </div>
    </div>
  )
}
