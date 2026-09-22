import type { StoreApi } from 'zustand'
import type { ComposerState } from '../hooks/use-composer-store'

type ComposerSet = StoreApi<ComposerState>['setState']

export function draftActions(set: ComposerSet) {
  return {
    chooseHarness: (harness: ComposerState['harness']) => set({ harness }),
    setDraft: (composerKey: string, text: string) =>
      set(({ drafts }) => {
        const { [composerKey]: _replaced, ...others } = drafts
        return { drafts: text === '' ? others : { ...others, [composerKey]: text } }
      }),
  }
}
