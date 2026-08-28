import Foundation

/// Routes a Work Item read to the adapter that speaks its provider.
///
/// The third place a new provider has to appear, beside `ProviderScopeCheck` and
/// `ProviderScopeCatalog`, and exhaustive over `AccountProvider` for the same reason: a third
/// provider fails the build here rather than shipping a poll that silently reads nothing.
///
/// It is `WorkItemReading` and not `WorkItemPort` because the port's own method takes a scope and
/// a grant, which do not say WHICH provider issued the grant — and a GitHub token sent to Linear
/// is the one outcome worth ruling out at the type level.
public struct ProviderWorkItems: WorkItemReading {
    private let github: WorkItemPort
    private let linear: WorkItemPort

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.github = GitHubWorkItems(transport: transport)
        self.linear = LinearWorkItems(transport: transport)
    }

    public func list(through binding: ResolvedBinding) async throws -> [WorkItem] {
        try await port(binding.provider).list(in: binding.binding.scope, grant: binding.grant)
    }

    private func port(_ provider: AccountProvider) -> WorkItemPort {
        switch provider {
        case .github: github
        case .linear: linear
        }
    }
}
