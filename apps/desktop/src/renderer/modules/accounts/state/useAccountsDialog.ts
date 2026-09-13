import { create } from 'zustand'

// The sidebar's Account control and the room's Connect and Reconnect actions open one dialog.
// `opener` is the control that opened it, for focus to return to when it closes.
type AccountsDialogState = {
  open: boolean
  opener: Element | null
  setOpen: (open: boolean) => void
}

export const useAccountsDialog = create<AccountsDialogState>((set) => ({
  open: false,
  opener: null,
  setOpen: (open) => set({ open }),
}))

export const openAccountsDialog = (): void =>
  useAccountsDialog.setState({ open: true, opener: document.activeElement })
