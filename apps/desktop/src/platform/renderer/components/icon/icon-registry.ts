import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  BadgeCheck,
  Ban,
  BellRing,
  BookMarked,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  CircleDotDashed,
  CircleGauge,
  CircleX,
  CloudOff,
  Code2,
  Copy,
  Download,
  Expand,
  ExternalLink,
  EyeOff,
  File,
  FileCheck2,
  FileCode2,
  FileCog,
  FileInput,
  FileJson,
  FilePenLine,
  FileText,
  Folder,
  FolderGit2,
  FolderPlus,
  FolderTree,
  Gem,
  GitBranch,
  GitCompareArrows,
  GitFork,
  GitMerge,
  GitMergeConflict,
  GitPullRequest,
  GitPullRequestArrow,
  GitPullRequestClosed,
  Globe,
  GripVertical,
  Hand,
  HardDrive,
  Hourglass,
  ImageOff,
  Inbox,
  Info,
  KeyRound,
  Layers3,
  Library,
  ListTodo,
  Loader2,
  Lock,
  LockKeyhole,
  Map as MapIcon,
  MessageSquare,
  MessagesSquare,
  Minimize2,
  OctagonAlert,
  Package,
  PanelLeft,
  PanelRight,
  PanelsTopLeft,
  Pencil,
  Plug,
  Plus,
  RotateCw,
  Route,
  Search,
  Settings,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  SlidersHorizontal,
  SlidersVertical,
  Sparkles,
  Square,
  SquareTerminal,
  Terminal,
  Ticket,
  TimerOff,
  Trash2,
  TriangleAlert,
  Unplug,
  Wand2,
  WandSparkles,
  Wrench,
  X,
} from 'lucide-react'

// The vocabulary: one semantic name per concept, however many call sites draw it, and however
// many concepts share the same glyph. Extend this map rather than importing a lucide icon
// directly at a call site, and name the entry for what it means here, never for lucide's own
// name for the glyph.
export const ICONS = {
  // Truly generic actions and entities: the same meaning at every call site, so one shared name
  // earns its keep the way `close` or `success` does.
  add: Plus,
  close: X,
  confirmed: Check,
  copy: Copy,
  download: Download,
  expand: Expand,
  file: File,
  folder: Folder,
  'file-text': FileText,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  info: Info,
  search: Search,
  settings: Settings,
  'messages-square': MessagesSquare,
  session: MessagesSquare,
  'panel-left': PanelLeft,
  'panel-right': PanelRight,
  ticket: Ticket,
  success: CheckCircle2,

  // A ticket's own "blocked" mark, wherever it's drawn.
  blocked: Ban,

  // A Session's own "linked pull request" marker in the roster (no state today — see
  // 'pull-request-open' and its siblings for the states a future roster row can draw).
  'pull-request-linked': GitPullRequestArrow,

  // Tickets screen and detail.
  repository: FolderGit2,
  'ticket-children': GitFork,
  'ticket-source': BookMarked,
  'linked-sessions': MessageSquare,
  'no-search-results': CircleX,
  'open-external': ExternalLink,

  // Session composer and Feed.
  agent: Bot,
  back: ArrowLeft,
  send: ArrowUp,
  interrupt: Square,
  reasoning: Brain,
  'context-stack': Layers3,
  'usage-meter': CircleGauge,
  'roster-filter': SlidersVertical,
  'no-sessions': Inbox,
  'archive-session': Archive,
  'awaiting-permission': Lock,
  'empty-feed': Inbox,
  'drag-handle': GripVertical,
  'queued-turn-path': Route,
  'delete-queued-turn': Trash2,
  'edit-queued-turn': Pencil,
  'jump-to-latest': ArrowDown,
  retry: RotateCw,
  'image-unavailable': ImageOff,
  'diff-view': GitCompareArrows,
  'language-ruby': Gem,
  'language-generic': FileCode2,
  'shell-output': Terminal,

  // The cockpit rail's own destinations.
  atlas: MapIcon,

  // Guided Project setup.
  connect: Plug,
  branch: GitBranch,
  'new-project': FolderPlus,
  'target-repository': Package,
  'source-code': Code2,
  'config-file': FileJson,
  'generated-config': FileCog,
  'setup-configuration': Settings2,
  dependencies: Library,
  loading: Loader2,
  'setup-step-pending': Circle,
  tooling: Wrench,

  // Badges and status marks whose meaning is specific to where they're drawn.
  'badge-check': BadgeCheck,
  'octagon-alert': OctagonAlert,
  'shield-question': ShieldQuestion,
  sparkles: Sparkles,
  'triangle-alert': TriangleAlert,
  warning: TriangleAlert,

  // A ticket's own state, as drawn in the context-picker search results.
  'ticket-open': Circle,
  'ticket-in-progress': CircleDotDashed,
  'ticket-done': CheckCircle2,
  'ticket-closed': CircleX,

  // A linked ticket's state, as drawn in a Ticket's own Dependencies section.
  'ticket-link-open': CircleDot,
  'ticket-link-closed': CircleCheck,

  // A Ticket problem: why the backlog or an Account connection can't be shown.
  'connection-offline': CloudOff,
  'rate-limited': Hourglass,
  'account-expired': TimerOff,
  'account-revoked': KeyRound,
  'account-locked': LockKeyhole,
  'account-disconnected': Unplug,
  'not-visible': EyeOff,
  'storage-error': HardDrive,

  // A Session Feed row's own kind.
  'event-command': SquareTerminal,
  'event-context': SlidersHorizontal,
  'event-status': BellRing,
  'event-transcript': FileInput,

  // A tool call's kind, drawn in the Feed.
  'tool-terminal': SquareTerminal,
  'tool-edit-file': FilePenLine,
  'tool-generic': Wrench,
  'tool-magic': Wand2,
  'tool-web': Globe,

  // A Turn's permission Mode, drawn in the mode menu.
  'mode-auto': WandSparkles,
  'mode-manual': Hand,
  'mode-accept-edits': FileCheck2,
  'mode-plan': ListTodo,
  'mode-dont-ask': ShieldX,
  'mode-bypass-permissions': ShieldAlert,
  'mode-approve-safely': ShieldCheck,

  // A skill or slash command mentioned inline.
  'skill-invocation': WandSparkles,

  // Session header and composer actions.
  compact: Minimize2,
  handoff: ArrowRightLeft,

  // A split inspector panel's own expand/restore control.
  restore: Minimize2,

  // A guided Project setup plan's review.
  verification: SquareTerminal,

  // A Project's own workspace, and the worktree a Session runs its branch in.
  workspace: PanelsTopLeft,
  worktree: FolderTree,

  // A linked pull request's own state (CONTEXT.md L4 · Delivery).
  'pull-request-open': GitPullRequest,
  'pull-request-merged': GitMerge,
  'pull-request-closed': GitPullRequestClosed,
  'pull-request-conflict': GitMergeConflict,
} as const

export type IconName = keyof typeof ICONS
