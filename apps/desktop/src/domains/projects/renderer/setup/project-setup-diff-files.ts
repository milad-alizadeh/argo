import type { FileDiff } from '@/platform/renderer/components/file-diff-list'

export function projectSetupDiffFiles(source: string | null): FileDiff[] {
  if (!source?.trim()) return []
  const sections = source.split(/^diff --git /m).filter((section) => section.trim())
  if (!source.startsWith('diff --git ') || sections.length === 0)
    return [{ path: 'Project changes', diff: source }]
  return sections.map((section) => {
    const [header = '', ...lines] = section.split('\n')
    const path = /^a\/(.+) b\/(.+)$/.exec(header)?.[2] ?? header
    const firstHunk = lines.findIndex((line) => line.startsWith('@@'))
    return {
      path,
      diff: lines.slice(firstHunk < 0 ? 0 : firstHunk).join('\n'),
    }
  })
}
