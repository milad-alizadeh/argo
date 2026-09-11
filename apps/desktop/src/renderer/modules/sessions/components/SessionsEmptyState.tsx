type SessionsEmptyStateProps = { message: string }

export function SessionsEmptyState({ message }: SessionsEmptyStateProps) {
  return (
    <div
      data-component="SessionsEmptyState"
      className="grid min-h-full place-items-center px-6 text-center"
    >
      <p className="max-w-sm type-prose text-muted-foreground">{message}</p>
    </div>
  )
}
