// No Account and no Binding: a story that reaches the Tickets screen draws its first-run screen.
export const ticketsHost = {
  listAccounts: (request: { requestId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'account.listed',
      requestId: request.requestId,
      accounts: [],
      notice: false,
    }),
  readBinding: (request: { requestId: string; projectId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'ticket.bound',
      requestId: request.requestId,
      projectId: request.projectId,
      binding: null,
    }),
}
