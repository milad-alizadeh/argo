import {
  ArchiveIcon,
  ArrowClockwiseIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ArrowUpIcon,
  ArrowsInIcon,
  ArrowsLeftRightIcon,
  ArrowsOutIcon,
  BellRingingIcon,
  BookBookmarkIcon,
  BooksIcon,
  BrainIcon,
  CaretDownIcon,
  CaretRightIcon,
  ChatIcon,
  ChatsIcon,
  CheckIcon,
  CheckCircleIcon,
  CircleIcon,
  CircleDashedIcon,
  CloudSlashIcon,
  CodeIcon,
  CopyIcon,
  DiamondIcon,
  DotsSixVerticalIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  EyeSlashIcon,
  FileIcon,
  FileArrowDownIcon,
  FileCodeIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderSimpleIcon,
  FolderSimpleStarIcon,
  GaugeIcon,
  GearSixIcon,
  GitBranchIcon,
  GitDiffIcon,
  GitForkIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  GlobeIcon,
  HandIcon,
  HardDriveIcon,
  HourglassIcon,
  ImageBrokenIcon,
  InfoIcon,
  KeyIcon,
  ListChecksIcon,
  LockKeyIcon,
  LockSimpleIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PackageIcon,
  PlugsIcon,
  PlugsConnectedIcon,
  PlusIcon,
  ProhibitIcon,
  RecordIcon,
  RobotIcon,
  SealCheckIcon,
  ShieldIcon,
  ShieldCheckIcon,
  ShieldSlashIcon,
  ShieldWarningIcon,
  SidebarSimpleIcon,
  SlidersIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
  SpinnerGapIcon,
  SquareIcon,
  SquaresFourIcon,
  StackIcon,
  TerminalIcon,
  TerminalWindowIcon,
  TicketIcon,
  TimerIcon,
  TrayIcon,
  TreeStructureIcon,
  WarningIcon,
  WarningDiamondIcon,
  WarningOctagonIcon,
  WrenchIcon,
  XIcon,
  XCircleIcon,
} from '@phosphor-icons/react'


// The vocabulary: one semantic name per concept, however many call sites draw it, and however
// many concepts share the same glyph. Extend this map rather than importing a Phosphor icon
// directly at a call site, and name the entry for what it means here, never for Phosphor's own
// name for the glyph.
export const ICONS = {
  // Truly generic actions and entities: the same meaning at every call site, so one shared name
  // earns its keep the way `close` or `success` does.
  add: PlusIcon,
  close: XIcon,
  confirmed: CheckIcon,
  copy: CopyIcon,
  download: DownloadSimpleIcon,
  expand: ArrowsOutIcon,
  file: FileIcon,
  folder: FolderIcon,
  'file-text': FileTextIcon,
  'chevron-down': CaretDownIcon,
  'chevron-right': CaretRightIcon,
  info: InfoIcon,
  search: MagnifyingGlassIcon,
  settings: GearSixIcon,
  'messages-square': ChatsIcon,
  session: ChatsIcon,
  'panel-left': SidebarSimpleIcon,
  'panel-right': SidebarSimpleIcon,
  ticket: TicketIcon,
  success: CheckCircleIcon,

  // A ticket's own "blocked" mark, wherever it's drawn.
  blocked: ProhibitIcon,

  // A Session's own "linked pull request" marker in the roster (no state today — see
  // 'pull-request-open' and its siblings for the states a future roster row can draw).
  'pull-request-linked': GitPullRequestIcon,

  // Tickets screen and detail.
  repository: FolderSimpleIcon,
  'ticket-children': GitForkIcon,
  'ticket-source': BookBookmarkIcon,
  'linked-sessions': ChatIcon,
  'no-search-results': XCircleIcon,
  'open-external': ArrowSquareOutIcon,

  // Session composer and Feed.
  agent: RobotIcon,
  back: ArrowLeftIcon,
  send: ArrowUpIcon,
  interrupt: SquareIcon,
  reasoning: BrainIcon,
  'context-stack': StackIcon,
  'usage-meter': GaugeIcon,
  'session-list-filter': SlidersIcon,
  'no-sessions': TrayIcon,
  'archive-session': ArchiveIcon,
  'awaiting-permission': LockSimpleIcon,
  'empty-feed': TrayIcon,
  'drag-handle': DotsSixVerticalIcon,
  'jump-to-latest': ArrowDownIcon,
  retry: ArrowClockwiseIcon,
  'image-unavailable': ImageBrokenIcon,
  'diff-view': GitDiffIcon,
  'language-ruby': DiamondIcon,
  'language-generic': FileCodeIcon,
  'shell-output': TerminalIcon,

  // The cockpit rail's own destinations.
  atlas: TreeStructureIcon,

  // Guided Project setup.
  connect: PlugsConnectedIcon,
  branch: GitBranchIcon,
  'new-project': FolderPlusIcon,
  'target-repository': PackageIcon,
  'source-code': CodeIcon,
  'config-file': FileCodeIcon,
  'generated-config': FileCodeIcon,
  'setup-configuration': SlidersHorizontalIcon,
  dependencies: BooksIcon,
  loading: SpinnerGapIcon,
  'setup-step-pending': CircleIcon,
  tooling: WrenchIcon,

  // Badges and status marks whose meaning is specific to where they're drawn.
  'badge-check': SealCheckIcon,
  'octagon-alert': WarningOctagonIcon,
  'shield-question': ShieldIcon,
  sparkles: SparkleIcon,
  'triangle-alert': WarningIcon,
  warning: WarningIcon,

  // A ticket's own state, as drawn in the context-picker search results.
  'ticket-open': CircleIcon,
  'ticket-in-progress': CircleDashedIcon,
  'ticket-done': CheckCircleIcon,
  'ticket-closed': XCircleIcon,

  // A linked ticket's state, as drawn in a Ticket's own Dependencies section.
  'ticket-link-open': RecordIcon,
  'ticket-link-closed': CheckCircleIcon,

  // A Ticket problem: why the backlog or an Account connection can't be shown.
  'connection-offline': CloudSlashIcon,
  'rate-limited': HourglassIcon,
  'account-expired': TimerIcon,
  'account-revoked': KeyIcon,
  'account-locked': LockKeyIcon,
  'account-disconnected': PlugsIcon,
  'not-visible': EyeSlashIcon,
  'storage-error': HardDriveIcon,

  // A Session Feed row's own kind.
  'event-command': TerminalWindowIcon,
  'event-context': SlidersHorizontalIcon,
  'event-status': BellRingingIcon,
  'event-transcript': FileArrowDownIcon,

  // A tool call's kind, drawn in the Feed.
  'tool-terminal': TerminalWindowIcon,
  'tool-edit-file': NotePencilIcon,
  'tool-generic': WrenchIcon,
  'tool-magic': MagicWandIcon,
  'tool-web': GlobeIcon,

  // A Turn's permission Mode, drawn in the mode menu.
  'mode-auto': MagicWandIcon,
  'mode-manual': HandIcon,
  'mode-accept-edits': FileCodeIcon,
  'mode-plan': ListChecksIcon,
  'mode-dont-ask': ShieldSlashIcon,
  'mode-bypass-permissions': ShieldWarningIcon,
  'mode-approve-safely': ShieldCheckIcon,

  // A skill or slash command mentioned inline.
  'skill-invocation': MagicWandIcon,

  // Session header and composer actions.
  'context-actions': DotsThreeIcon,
  compact: ArrowsInIcon,
  handoff: ArrowsLeftRightIcon,

  // A split inspector panel's own expand/restore control.
  restore: ArrowsInIcon,

  // A guided Project setup plan's review.
  verification: TerminalWindowIcon,

  // A Project's own workspace, and the worktree a Session runs its branch in.
  workspace: SquaresFourIcon,
  worktree: FolderSimpleStarIcon,

  // A linked pull request's own state (CONTEXT.md L4 · Delivery).
  'pull-request-open': GitPullRequestIcon,
  'pull-request-merged': GitMergeIcon,
  'pull-request-closed': GitPullRequestIcon,
  'pull-request-conflict': WarningDiamondIcon,
} as const

export type IconName = keyof typeof ICONS
