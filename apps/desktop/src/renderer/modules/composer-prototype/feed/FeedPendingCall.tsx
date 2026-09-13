import { LoaderCircle } from 'lucide-react'
import { Marker, MarkerContent, MarkerIcon } from '@/renderer/components/ui/marker'

export function FeedPendingCall({ mode = 'running' }: { mode?: 'running' | 'thinking' }) {
  return (
    <Marker className="py-2 type-body" role="status">
      <MarkerIcon>
        <LoaderCircle className="!size-(--size-icon-control) motion-safe:animate-spin" />
      </MarkerIcon>
      <MarkerContent>
        <span className="font-medium">{mode === 'thinking' ? 'Thinking' : 'Running'}</span>
        <span className="ml-1 text-foreground">the attachment stress check</span>
      </MarkerContent>
      <span className="ml-auto type-meta text-muted-foreground">12s</span>
    </Marker>
  )
}
