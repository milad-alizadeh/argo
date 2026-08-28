import Foundation

/// Routes a Work Item WRITE to the adapter that speaks the Binding's provider — the write-side twin
/// of `ProviderWorkItems`, and exhaustive over `AccountProvider` for the same reason: a third
/// provider fails the build here rather than shipping a create that silently goes nowhere.
///
/// It hands back a port rather than being one: `WorkItemWriting.surface` takes no Binding, and a
/// router has no adapter to answer for until one names it.
public struct ProviderWorkItemWrites: Sendable {
    private let github: WorkItemWriting
    private let linear: WorkItemWriting

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.github = GitHubWorkItems(transport: transport)
        self.linear = LinearWorkItems(transport: transport)
    }

    public func port(of provider: AccountProvider) -> WorkItemWriting {
        switch provider {
        case .github: github
        case .linear: linear
        }
    }

    /// The writer for one Binding, over the ledger the room draws from and the health the chip
    /// reads.
    public func writer(
        for binding: ResolvedBinding, items: WorkItemLedger, health: ConnectionHealthLedger,
    )
        -> WorkItemWriter {
        WorkItemWriter(port: port(of: binding.provider), items: items, health: health)
    }
}
