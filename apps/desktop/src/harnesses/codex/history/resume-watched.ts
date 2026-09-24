import { beginWatchedResume as begin } from '@/harnesses/composition/begin-watched-resume'

export const beginWatchedResume = (options: Omit<Parameters<typeof begin>[0], 'openFailure'>) =>
  begin({
    ...options,
    openFailure: 'Codex refused to resume this Session.',
  })
