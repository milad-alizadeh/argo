import { FileHeader, FileHeaderPath } from '@/platform/renderer/components/file-header'
import { inspectorHeaderPlacement } from './inspector-recipes'

export function InspectorPathHeader({ path }: { path: string }) {
  return (
    <header className={inspectorHeaderPlacement}>
      <FileHeader
        heading={<FileHeaderPath path={path} />}
        titleClassName="type-code"
        variant="inspector"
      />
    </header>
  )
}
