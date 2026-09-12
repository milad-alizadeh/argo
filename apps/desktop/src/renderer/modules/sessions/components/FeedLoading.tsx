export function FeedLoading({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      className="grid h-full place-items-center text-muted-foreground"
      data-component="FeedLoading"
      role="status"
    >
      {label}
    </div>
  )
}
