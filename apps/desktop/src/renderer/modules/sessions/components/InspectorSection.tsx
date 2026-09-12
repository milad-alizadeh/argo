import type { ReactNode } from 'react'

export function InspectorSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="session-page__inspector-section"
      data-component="InspectorSection"
    >
      <h3 className="text-heading font-medium">{label}</h3>
      <ul>{children}</ul>
    </section>
  )
}
