import Foundation

/// The two provider reads a Binding needs, together: the one that OFFERS scopes and the one that
/// CHECKS the scope that was picked.
///
/// One value rather than two parameters because they are one substitution — a suite that stands in
/// for GitHub stands in for both halves of it, and a `ProjectBindings` holding a fake check over a
/// live catalogue would reach the network from a test that thought it could not.
public struct BindingProviderSeams: Sendable {
    public let scopeCheck: BindingScopeCheck
    public let catalog: BindingScopeCatalog

    public init(
        scopeCheck: BindingScopeCheck = ProviderScopeCheck(),
        catalog: BindingScopeCatalog = ProviderScopeCatalog(),
    ) {
        self.scopeCheck = scopeCheck
        self.catalog = catalog
    }

    /// Both halves over one transport, which is how the app builds them and how a test that records
    /// provider responses substitutes them.
    public init(transport: HTTPTransport) {
        self.init(
            scopeCheck: ProviderScopeCheck(transport: transport),
            catalog: ProviderScopeCatalog(transport: transport),
        )
    }
}
