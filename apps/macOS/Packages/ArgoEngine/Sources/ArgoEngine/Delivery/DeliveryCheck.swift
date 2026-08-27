import Foundation

/// One observed CI check on a Delivery (`CONTEXT.md` L4 · Check).
///
/// **One level only** — no job or step tree. A code host that nests them is read at its top level
/// and no further: the strip's `ci` node is a roll-up, and a tree behind it would be a second
/// navigation surface nothing asked for.
///
/// **Local lint and test are never here.** Argo observes git state and never runs or parses
/// tooling, so before a push there are simply no Checks — which is "no CI yet" and not a pass.
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
