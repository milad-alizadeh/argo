// No Account and no Connection: a story that reaches the Tickets screen draws its first-run screen.
export const ticketsHost = {
  listAccounts: (request: { requestId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'account.listed',
      requestId: request.requestId,
      accounts: [],
      notice: false,
    }),
  readConnection: (request: { requestId: string; projectId: string }) =>
    Promise.resolve({
      version: 1,
      type: 'ticket.connected',
      requestId: request.requestId,
      projectId: request.projectId,
      connection: null,
    }),
}
