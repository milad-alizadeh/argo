type SessionStatusProps = { status: string }

const statusStyles: Record<string, string> = {
  active: 'bg-active text-canvas',
  idle: 'bg-muted text-canvas',
  waiting: 'bg-warn text-canvas',
  failed: 'bg-danger text-canvas',
}

export function SessionStatus({ status }: SessionStatusProps) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-xs tracking-wide ${statusStyles[status] ?? 'bg-rule text-ink'}`}
    >
      {status}
    </span>
  )
}
