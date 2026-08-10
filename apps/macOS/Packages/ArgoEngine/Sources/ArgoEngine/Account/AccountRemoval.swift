import Foundation

/// A Binding that names an Account, addressed by the Project it belongs to and the port it fills.
///
/// The Binding entity itself is #B's. What is owed *here* is the ability to say what removing an
/// Account would break, because the alternative is a Binding left pointing at an identity that no
/// longer exists — which reads downstream as a provider that 404s, indistinguishable from a ticket
/// that does not exist (ADR-0018).
public struct AccountBindingReference: Equatable, Sendable {
    public let projectID: String
    public let port: AccountPort

    public init(projectID: String, port: AccountPort) {
        self.projectID = projectID
        self.port = port
    }
}

/// Who is using an Account. One method, because one question is all the Account level has to ask
/// of the Binding level, and the arrow points this way so `AccountRegistryStore` never has to know
/// how Bindings are stored.
public protocol AccountBindingIndex: Sendable {
    func bindings(referencing accountID: String) async -> [AccountBindingReference]
}

/// The answer until #B lands: nothing binds anything, so nothing is orphaned.
///
/// A real empty answer rather than a stub — no Bindings exist on this machine yet, so this is the
/// truth, and it stops being the truth by being replaced rather than by being corrected.
public struct NoAccountBindings: AccountBindingIndex {
    public init() {}

    public func bindings(referencing _: String) async -> [AccountBindingReference] {
        []
    }
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
