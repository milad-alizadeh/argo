export type FeedPrototypeEvidence = {
  id: string
  title: string
  kind: 'code' | 'output' | 'diff' | 'image' | 'diagram' | 'document'
  source: string
  detail: string
  status?: 'succeeded' | 'failed' | 'pending'
}

export type FeedEvidenceAction = (evidence: FeedPrototypeEvidence) => void

export const COMPOSER_CODE = `export function Composer({ session }: ComposerProps) {
  const draft = useDraft(session.id)

  return (
    <PromptInput onSubmit={draft.submit}>
      <AttachmentTray files={draft.attachments} />
      <MessageField value={draft.text} />
      <RunControls session={session} />
      <ContextBar context={session.context} />
    </PromptInput>
  )
}`

export const MERMAID_SOURCE = `flowchart TD
  A[Draft + attachments] --> B[Session driver]
  B --> C[Claude · PTY]
  B --> D[Codex · JSON-RPC]
  C --> E[Feed]
  D --> E`

export const FEED_EVIDENCE = {
  source: {
    id: 'source',
    title: 'Composer.tsx',
    kind: 'code',
    source: COMPOSER_CODE,
    detail: 'apps/desktop/src/renderer/modules/sessions/Composer.tsx · Recorded read',
  },
  search: {
    id: 'search',
    title: 'Search results',
    kind: 'output',
    source:
      'rg "ContextBar|AttachmentTray" apps/desktop/src\n\nComposer.tsx:8:  <AttachmentTray files={draft.attachments} />\nComposer.tsx:11: <ContextBar context={session.context} />\nContextBar.tsx:4: export function ContextBar({ context }) {',
    detail: 'Searched for ContextBar and AttachmentTray · 3 matches',
  },
  tests: {
    id: 'tests',
    title: 'Composer verification',
    kind: 'output',
    source:
      '$ bun test composer\n\n✓ retains the draft when switching Sessions\n✓ scrolls ten attachments without widening the field\n✓ submits one Turn with its attachments\n\n3 passed\n0 failed\nFinished in 0.84s',
    detail: 'Recorded command output · Exit 0 · 0.84 seconds',
    status: 'succeeded',
  },
  diff: {
    id: 'diff',
    title: 'Composer.tsx',
    kind: 'diff',
    source:
      '@@ Composer attachment tray @@\n- <div className="flex flex-wrap gap-2">\n+ <div className="flex gap-2 overflow-x-auto">\n    {attachments.map(renderAttachment)}\n  </div>\n+ <ContextBar context={session.context} />',
    detail: 'Recorded edit · +2 −1 · This change at the time of the call',
    status: 'succeeded',
  },
  image: {
    id: 'image',
    title: 'workspace-reference.jpg',
    kind: 'image',
    source: '/prototype-assets/workspace.jpg',
    detail: 'Embedded image · 320 × 213 · The image attached to this Turn',
  },
  currentImage: {
    id: 'current-image',
    title: 'workspace-reference.jpg',
    kind: 'image',
    source: '/prototype-assets/workspace.jpg',
    detail: 'Current file · Original image bytes were not kept in the transcript',
  },
  diagram: {
    id: 'diagram',
    title: 'From draft to Feed',
    kind: 'diagram',
    source: MERMAID_SOURCE,
    detail: 'Mermaid · Flowchart · Recorded assistant message',
  },
  skill: {
    id: 'skill',
    title: 'prototype',
    kind: 'document',
    source:
      'Explore the composer in its Session.\n\nKeep the draft, attachments and run controls together. Use the existing token contract and inspect every requested state. This is a disposable prototype.',
    detail: 'Skill loaded · Instructions supplied to this Session',
  },
  failed: {
    id: 'failed',
    title: 'Preview could not start',
    kind: 'output',
    source:
      '$ bun run preview\n\nError: Port 5191 is already in use.\nThe existing preview remains available at http://localhost:5191.',
    detail: 'Recorded command output · Exit 1',
    status: 'failed',
  },
  fetched: {
    id: 'fetched',
    title: 'Composer migration contract',
    kind: 'document',
    source:
      'Issue #1824\n\nUse Lexical inside the AI Elements PromptInput shell. Persist drafts as ordinary text. Attachments are separate. Model, Effort and Mode reflect the Session contract.',
    detail: 'Fetched GitHub issue #1824 · Recorded result',
  },
  mcp: {
    id: 'mcp',
    title: 'github.get_issue',
    kind: 'output',
    source:
      '{\n  "number": 1838,\n  "title": "Start and continue a managed Claude Session",\n  "state": "open"\n}',
    detail: 'MCP tool result · GitHub',
  },
} satisfies Record<string, FeedPrototypeEvidence>
