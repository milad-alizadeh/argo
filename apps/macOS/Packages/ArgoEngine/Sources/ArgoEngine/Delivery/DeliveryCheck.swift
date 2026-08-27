import Foundation

/// One observed CI check on a Delivery (`CONTEXT.md` L4 · Check).
///
/// One level only — a host that nests jobs or steps inside a check is read at its top level and no
/// further. Local lint and test are never here: Argo runs and parses no tooling.
public struct DeliveryCheck: Equatable, Sendable, Identifiable {
    /// The code host's own name for the check, verbatim. Renaming it would misrepresent what was
    /// observed, and the name is what a reader matches against their own CI configuration.
    public let name: String
    /// The host's own word for how it went — its conclusion once it has one, and its in-flight
    /// status until then. One field because a surface draws one word, and both are the host's.
    public let status: String

    public init(name: String, status: String) {
        self.name = name
        self.status = status
    }

    public var id: String {
        name
    }
}
