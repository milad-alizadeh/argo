import { Progress } from '../../../components/ui/progress'

const COMPOSITION = [
  { label: 'Conversation', percentage: 71, value: '86k' },
  { label: 'System prompt', percentage: 13, value: '16k' },
  { label: 'MCP tools', percentage: 8, value: '10k' },
  { label: 'Memory files', percentage: 5, value: '6k' },
  { label: 'Skills', percentage: 3, value: '3k' },
]

export function ClaudeContextComposition() {
  return (
    <details className="group type-body">
      <summary className="cursor-pointer font-medium">Loaded context</summary>
      <div className="mt-2 grid gap-2">
        {COMPOSITION.map((item) => (
          <div className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2" key={item.label}>
            <span className="text-muted-foreground">{item.label}</span>
            <Progress className="h-1.5" value={item.percentage} />
            <span className="text-right tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
    </details>
  )
}
