import './tokens.css'

export type RuntimeVersions = {
  electron: string
  chrome: string
}

export function AppSurface({ versions }: { versions: RuntimeVersions }) {
  return (
    <main className="app-shell" data-component="AppSurface">
      <section className="app-card" data-component="LandingPanel">
        <h1 className="app-title">Argo</h1>
        <p className="app-copy">
          Electron {versions.electron} · Chromium {versions.chrome}
        </p>
        <p className="app-copy" data-component="StatusLine">
          Design-system state: connected and ready.
        </p>
      </section>
    </main>
  )
}

export function App() {
  return <AppSurface versions={window.argo.versions} />
}
