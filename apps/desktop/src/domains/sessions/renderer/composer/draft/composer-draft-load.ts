export function shouldLoadComposerDraft(input: {
  owner: string
  loadedOwner: string | null
  isFetching: boolean
  isError: boolean
}) {
  return input.loadedOwner !== input.owner && !input.isFetching && !input.isError
}
