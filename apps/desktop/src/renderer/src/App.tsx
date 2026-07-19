import { CompassIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

// Empty-window skeleton (issue #2): no Session is observed yet. This proves the
// full renderer stack is wired — React 19, Tailwind 4 tokens, a shadcn/ui
// component, and a Phosphor Light icon — and gives the app-launch smoke a stable
// surface to assert against. Later tickets replace this with the rail + Actor tree.
function App(): React.JSX.Element {
  return (
    <main
      data-testid="cockpit-root"
      className="flex h-screen w-screen select-none flex-col items-center justify-center gap-4"
    >
      <CompassIcon weight="light" size={48} className="text-muted-foreground" />
      <h1 className="font-medium text-lg tracking-tight">Argo Cockpit</h1>
      <p className="text-muted-foreground text-sm">No Sessions observed yet.</p>
      <Button variant="outline" size="sm" disabled>
        Waiting for a Session
      </Button>
    </main>
  )
}

export default App
