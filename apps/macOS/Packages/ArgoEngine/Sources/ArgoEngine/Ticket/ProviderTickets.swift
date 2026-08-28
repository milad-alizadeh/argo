import Foundation

/// Routes a Ticket read to the adapter that speaks its provider.
///
/// The third place a new provider has to appear, beside `ProviderScopeCheck` and
/// `ProviderScopeCatalog`, and exhaustive over `AccountProvider` for the same reason: a third
/// provider fails the build here rather than shipping a poll that silently reads nothing.
///
/// It is `TicketReading` and not `TicketPort` because the port's own method takes a scope and
/// a grant, which do not say WHICH provider issued the grant — and a GitHub token sent to Linear
/// is the one outcome worth ruling out at the type level.
public struct ProviderTickets: TicketReading {
    private let github: TicketPort
    private let linear: TicketPort

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.github = GitHubTickets(transport: transport)
        self.linear = LinearTickets(transport: transport)
    }

    public func list(through binding: ResolvedBinding) async throws -> [Ticket] {
        try await port(binding.provider).list(in: binding.binding.scope, grant: binding.grant)
    }

    private func port(_ provider: AccountProvider) -> TicketPort {
        switch provider {
        case .github: github
        case .linear: linear
        }
    }
}
