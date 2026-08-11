import Foundation

/// A Binding that names an Account, addressed by the Project it belongs to and the port it fills.
///
/// Enough to say what removing an Account would break: a Binding left pointing at an identity
/// that no longer exists reads downstream as a provider that 404s, indistinguishable from a
/// ticket that does not exist (ADR-0018).
///
/// `Hashable` because it is also the key connection health is filed under — health is keyed by
/// Binding and never by Project (#260).
public struct AccountBindingReference: Hashable, Sendable {
    public let projectID: String
    public let port: AccountPort

    public init(projectID: String, port: AccountPort) {
        self.projectID = projectID
        self.port = port
    }
}

/// Who is using an Account. The arrow points this way so `AccountRegistryStore` never has to know
/// how Bindings are stored; `ProjectBindingIndex` is the answer.
public protocol AccountBindingIndex: Sendable {
    func bindings(referencing accountID: String) async -> [AccountBindingReference]
}

/// The registry after a removal, what was removed, and what it left pointing at nothing.
///
/// `orphaned` is reported rather than acted on: re-pointing a Binding is a choice about which
/// identity a Project reads through, and guessing it is exactly the silent re-point ADR-0018's
/// amendment rejects.
public struct AccountRemoval: Equatable, Sendable {
    public let registry: AccountRegistry
    public let removed: AccountRecord?
    public let orphaned: [AccountBindingReference]

    public init(
        registry: AccountRegistry,
        removed: AccountRecord?,
        orphaned: [AccountBindingReference],
    ) {
        self.registry = registry
        self.removed = removed
        self.orphaned = orphaned
    }
}
