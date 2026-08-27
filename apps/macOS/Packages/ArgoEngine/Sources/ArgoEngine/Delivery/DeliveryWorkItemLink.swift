import Foundation

/// What intent a branch serves, and on whose authority (`CONTEXT.md` L1 · the triangle).
///
/// The three positive cases stay apart because the tier differs: a closing reference is the host's
/// own, a number in a branch name is a convention read back, and an assertion is the user's.
public enum DeliveryWorkItemLink: Equatable, Sendable {
    /// The code host's own closing reference, which is the signal `/implement` writes and this
    /// reads back (ADR-0014).
    case native(Int)
    /// The number the branch name carries, by the convention `docs/agents/worktrees.md` fixes.
    case idInBranch(Int)
    /// A human said so. Reachable only where the derivation found nothing.
    case asserted(Int)
    /// An honest gap, never a guess.
    case unlinked

    public var number: Int? {
        switch self {
        case let .native(number), let .idInBranch(number), let .asserted(number): number
        case .unlinked: nil
        }
    }

    /// The join, in the precedence ADR-0014 fixed: native reference → id-in-branch → unlinked.
    /// `asserted` wins over a derived `unlinked` and never over a positive derivation (ADR-0017).
    public static func derived(
        branch: String, pullRequestBody: String?, asserted: Int?,
    )
        -> DeliveryWorkItemLink {
        if let number = pullRequestBody.flatMap(ClosingReference.number(in:)) {
            return .native(number)
        }
        if let number = WorkItemLink.number(branch: branch, workspaceLocation: nil) {
            return .idInBranch(number)
        }
        return asserted.map(DeliveryWorkItemLink.asserted) ?? .unlinked
    }
}
