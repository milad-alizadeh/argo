// The GitHub pages a Ticket opens in the default browser, which `setWindowOpenHandler` routes to.
const repositoryURL = (scope: string) => `https://github.com/${scope}`

export const newTicketURL = (scope: string) => `${repositoryURL(scope)}/issues/new`

export const ticketURL = (scope: string, ticketNumber: number) =>
  `${repositoryURL(scope)}/issues/${ticketNumber}`
