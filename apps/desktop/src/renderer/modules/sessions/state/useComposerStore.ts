import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { SESSION_CLIS, type SessionCli } from '../harness/harnesses'

// What a composer keeps across leaving the page and relaunching: each composer's unsent draft, and
// the harness the last new Session was set to, app-wide.
type ComposerState = {
  harness: SessionCli
  drafts: Record<string, string>
  chooseHarness: (harness: SessionCli) => void
  setDraft: (composerKey: string, text: string) => void
}

const storedSchema = z
  .object({ harness: z.enum(SESSION_CLIS), drafts: z.record(z.string(), z.string()) })
  .partial()

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      harness: 'claude',
      drafts: {},
      chooseHarness: (harness) => set({ harness }),
      setDraft: (composerKey, text) =>
        set(({ drafts }) => {
          const { [composerKey]: _replaced, ...others } = drafts
          return { drafts: text === '' ? others : { ...others, [composerKey]: text } }
        }),
    }),
    {
      name: 'argo.composer',
      partialize: ({ harness, drafts }) => ({ harness, drafts }),
      merge: (stored, current) => ({ ...current, ...storedSchema.safeParse(stored).data }),
    },
  ),
)
