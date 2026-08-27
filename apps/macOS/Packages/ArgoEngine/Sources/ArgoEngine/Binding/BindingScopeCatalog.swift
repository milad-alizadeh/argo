import Foundation

/// What Argo asks a provider *before* a Binding exists: which scopes can this identity, holding
/// this grant, be bound to **through this port**?
///
/// The mirror of `BindingProbe`, one step earlier. A probe asks about a scope the user named; this
/// asks the provider to name them, so the panel can offer what the Account can actually see rather
/// than a field to spell it into.
public struct ScopeQuery: Sendable {
    public let port: AccountPort
    public let provider: AccountProvider
    public let grant: AccountGrant

    public init(port: AccountPort, provider: AccountProvider, grant: AccountGrant) {
        self.port = port
        self.provider = provider
        self.grant = grant
    }
}

/// The provider's answer, in the shapes a picker can draw.
///
/// The failure cases match `ScopeVisibility`'s deliberately: a listing that could not be read has
/// not said the Account can see nothing, and an empty list rendered on that reading is a false
/// DIRECT (CONTEXT.md, degrade-down). `listed([])` is the honest empty — the read landed and there
/// was nothing in it.
public enum ScopeCatalogue: Equatable, Sendable {
    /// The scopes, in the order the provider is asked for them, and whether more exist than the one
    /// read returned. A truncated list rendered as a whole one is a repository the user cannot find
    /// and no reason given.
    case listed([String], truncated: Bool)
    case unauthorized
    case unreadable(String)
}

/// The seam the picker reads through, and the second place a new provider has to appear.
///
/// A provider that cannot list its scopes is not thereby unbindable — the catalogue is an
/// affordance, and `BindingScopeCheck` remains the thing that decides a bind. It is a protocol for
/// the same reason: the suite has no business reaching GitHub.
public protocol BindingScopeCatalog: Sendable {
    func scopes(for query: ScopeQuery) async -> ScopeCatalogue
}

/// Routes a query to the adapter that speaks its provider. Exhaustive over `AccountProvider`, so a
/// third provider fails the build here rather than shipping a picker that silently offers nothing.
public struct ProviderScopeCatalog: BindingScopeCatalog {
    private let github: BindingScopeCatalog

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.github = GitHubScopeCatalog(transport: transport)
    }

    public func scopes(for query: ScopeQuery) async -> ScopeCatalogue {
        switch query.provider {
        case .github: await github.scopes(for: query)
        // Linear's grant is #371's, so no Account of this provider exists to query. Answered rather
        // than crashed if one ever is: an empty picker would claim the workspace holds nothing.
        case .linear: .unreadable("Argo cannot list Linear projects yet.")
        }
    }
}
