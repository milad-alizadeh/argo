// A placeholder surface, not a design. The screens arrive per ticket from docs/designs/.
export function App() {
  const { electron, chrome } = window.argo.versions
  return (
    <main>
      <h1>Argo</h1>
      <p>
        Electron {electron} · Chromium {chrome}
      </p>
    </main>
  )
}
