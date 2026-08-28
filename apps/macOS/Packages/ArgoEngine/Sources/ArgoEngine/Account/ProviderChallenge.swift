import Foundation

/// How a provider asks the user to finish a grant — the one fact the two flows differ in.
///
/// An enum rather than an optional code beside a flag, because the two facts are not independent:
/// a typed flow always has a code and a redirect flow never does, and two primitives can spell a
/// third state that does not exist.
public enum ProviderChallengeKind: Equatable, Sendable {
    /// A code to TYPE at a fixed address, which is GitHub's. Argo does not open it: the address is
    /// short and part of the instruction, and taking the window while the user is still reading
    /// the code they have to bring is a step backwards.
    case typed(code: String)
    /// A page to APPROVE, which is Linear's. Argo opens it, because the user pressed Connect and a
    /// second control to reach the page they just asked for is a step nobody needs.
    case redirect
}

/// What the user has to do to finish a grant, whichever provider issues it.
public struct ProviderChallenge: Equatable, Sendable {
    public let provider: AccountProvider
    public let kind: ProviderChallengeKind
    public let url: URL

    /// The provider's own formatting, rendered verbatim, and `nil` on a redirect — where the
    /// browser carries the whole exchange and a code to copy would be an invented step.
    public var userCode: String? {
        guard case let .typed(code) = kind else { return nil }
        return code
    }

    public var opensItself: Bool {
        kind == .redirect
    }
}
