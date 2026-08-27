import Foundation

/// The two provider reads a Binding needs: the one that OFFERS scopes and the one that CHECKS the
/// scope that was picked.
///
/// One value because they are one substitution — a `ProjectBindings` holding a fake check over a
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
}
