import {
  Terminal,
  TerminalContent,
  TerminalCopyButton,
} from '@/domains/sessions/renderer/ai-elements/terminal'

// Command output filling the inspector edge to edge; the pane's own header already names it.
export function InspectorTerminal({
  output,
  streaming = false,
}: {
  output: string
  streaming?: boolean
}) {
  return (
    <Terminal
      className="relative min-h-0 flex-1 rounded-none border-0 bg-transparent"
      isStreaming={streaming}
      output={output}
    >
      <div className="absolute top-2 right-2">
        <TerminalCopyButton />
      </div>
      <TerminalContent className="max-h-none min-h-0 flex-1 type-code" />
    </Terminal>
  )
}
