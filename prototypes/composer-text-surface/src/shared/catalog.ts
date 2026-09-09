// PROTOTYPE. Stub catalogs standing in for the real ones, sized so the menus have to scroll.

export type CommandOrigin = 'Project' | 'Global' | 'Plugin' | 'Claude Code'

export type Command = {
  name: string
  detail: string
  origin: CommandOrigin
  shadowsUser?: boolean
}

export const commands: Command[] = [
  {
    name: 'implement',
    detail: 'Build a ticket end to end, review it, stop at the diff.',
    origin: 'Project',
  },
  { name: 'ship', detail: 'Gate, push, open the pull request.', origin: 'Project' },
  {
    name: 'pixel-review',
    detail: 'Render the affected states and judge the pixels.',
    origin: 'Project',
  },
  { name: 'prototype', detail: 'Throwaway code that answers one question.', origin: 'Project' },
  {
    name: 'prototype-to-design',
    detail: 'Approve one variant and land it as a design.',
    origin: 'Project',
  },
  { name: 'design-to-code', detail: 'Build a screen from its approved design.', origin: 'Project' },
  { name: 'wayfinder', detail: 'Chart or walk a map of decisions.', origin: 'Project' },
  { name: 'triage', detail: 'Label the never-triaged bucket.', origin: 'Project' },
  { name: 'grill', detail: 'Interrogate a loose idea until it is sharp.', origin: 'Global' },
  { name: 'research', detail: 'Read the world outside this repo.', origin: 'Global' },
  {
    name: 'domain-modeling',
    detail: 'Name the thing the way the model names it.',
    origin: 'Global',
  },
  { name: 'simple-english', detail: 'Rewrite it so it reads first time.', origin: 'Global' },
  {
    name: 'plan',
    detail: 'Turn an approved shape into an ordered list.',
    origin: 'Plugin',
    shadowsUser: true,
  },
  {
    name: 'perf-sweep',
    detail: 'Sample the frame budget across the seven workflows.',
    origin: 'Plugin',
  },
  {
    name: 'clear',
    detail: 'Clear conversation history and free up context.',
    origin: 'Claude Code',
  },
  { name: 'compact', detail: 'Condense the transcript and keep going.', origin: 'Claude Code' },
  { name: 'config', detail: 'Open the settings panel.', origin: 'Claude Code' },
  { name: 'cost', detail: 'Show token and dollar usage for this session.', origin: 'Claude Code' },
  { name: 'doctor', detail: 'Check the installation for problems.', origin: 'Claude Code' },
  { name: 'help', detail: 'List every command available here.', origin: 'Claude Code' },
  { name: 'model', detail: 'Choose the model this Session runs on.', origin: 'Claude Code' },
  { name: 'review', detail: 'Review a pull request from a fresh context.', origin: 'Claude Code' },
]

export const files: string[] = [
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerTextView.swift',
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerTextInput.swift',
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerKeyIntent.swift',
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerMenu.swift',
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerMenuList.swift',
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerMenuRow.swift',
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerField.swift',
  'apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/ComposerDrafts.swift',
  'apps/macOS/Packages/ArgoUI/Tests/ArgoUITests/ComposerCommandMarkTests.swift',
  'apps/macOS/Packages/ArgoUI/Tests/ArgoUITests/ComposerMenusTests.swift',
  'apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/SessionAttachment.swift',
  'docs/designs/cockpit-session-composer.md',
  'docs/designs/cockpit-composer-picker.md',
  'docs/domain/l2-session.md',
  'docs/agents/code-review.md',
  'AGENTS.md',
  'CONTEXT.md',
  'package.json',
  'biome.jsonc',
  'scripts/swift-gate.sh',
]

export type AddEntry = { id: string; lead: string; detail: string }

// The `+` menu: the same listing the sigils open, reached from a button instead of a typed sigil,
// so a pick drops nothing from the draft (design decision 11, #689).
export const addEntries: AddEntry[] = [
  { id: 'file', lead: 'Attach a file', detail: 'Choose from this Workspace' },
  { id: 'screenshot', lead: 'Attach a screenshot', detail: 'From the clipboard' },
  { id: 'command', lead: 'Run a command', detail: 'Skills and slash commands' },
  { id: 'mention', lead: 'Mention a file', detail: 'Put an @ path in the line' },
]
