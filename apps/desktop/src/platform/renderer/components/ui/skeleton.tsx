import { cn } from 'cn'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      // bg-muted is near-invisible in light mode (#2651); muted-foreground at low opacity reads as
      // a placeholder in both appearances.
      className={cn('animate-pulse rounded-md bg-muted-foreground/15', className)}
      {...props}
    />
  )
}

export { Skeleton }
