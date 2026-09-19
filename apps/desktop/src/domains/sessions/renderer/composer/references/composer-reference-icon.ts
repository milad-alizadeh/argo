import type { SessionReferenceKind } from '@/domains/sessions/renderer/composer/references/session-reference'

const iconPaths: Record<SessionReferenceKind, readonly string[]> = {
  command: ['M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3'],
  file: [
    'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
    'M14 2v5a1 1 0 0 0 1 1h5',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ],
  plugin: [
    'M12 22v-5',
    'M15 8V2',
    'M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z',
    'M9 8V2',
  ],
  skill: [
    'm21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72',
    'm14 7 3 3',
    'M5 6v4',
    'M19 14v4',
    'M10 2v2',
    'M7 8H3',
    'M21 16h-4',
    'M11 3H9',
  ],
}

export function composerReferenceIcon(document: Document, kind: SessionReferenceKind) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('class', 'size-3.5 shrink-0')
  icon.setAttribute('fill', 'none')
  icon.setAttribute('focusable', 'false')
  icon.setAttribute('stroke', 'currentColor')
  icon.setAttribute('stroke-linecap', 'round')
  icon.setAttribute('stroke-linejoin', 'round')
  icon.setAttribute('stroke-width', '2')
  icon.setAttribute('viewBox', '0 0 24 24')

  for (const d of iconPaths[kind]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    icon.appendChild(path)
  }

  return icon
}
