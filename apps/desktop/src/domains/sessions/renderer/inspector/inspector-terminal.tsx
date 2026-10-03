import { Terminal, TerminalContent, TerminalCopyButton } from '../ai-elements'

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
      className="relative min-h-0 flex-1"
      isStreaming={streaming}
      output={output}
      variant="embedded"
    >
      <div className="absolute top-2 right-2">
        <TerminalCopyButton />
      </div>
      <TerminalContent />
    </Terminal>
  )
}
