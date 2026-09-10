type SessionsEmptyStateProps = { message: string }

export function SessionsEmptyState({ message }: SessionsEmptyStateProps) {
  return (
    <div className="grid min-h-full place-items-center px-6 text-center">
      <p className="max-w-sm text-sm leading-6 text-muted">{message}</p>
    </div>
  )
}
