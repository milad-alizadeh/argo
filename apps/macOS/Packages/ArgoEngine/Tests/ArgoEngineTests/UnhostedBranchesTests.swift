@testable import ArgoEngine
import Testing

/// What the empty answers remember, and what they must forget (#1619).
///
/// Driven directly rather than through `DeliveryDerivation`, because forgetting is only observable
/// as a request the next tick makes — and a filter with its sense flipped would leave every suite
/// over the derivation green.
@Suite("Unhosted branches")
struct UnhostedBranchesTests {
    private static let scope = "acme/api"
    private static let branch = "spike/idea"

    /// The record after one empty answer, which is where every case here starts.
    private static func answered(at headSha: String?) -> UnhostedBranches {
        var unhosted = UnhostedBranches()
        unhosted.record(nil, ofBranch: branch, at: headSha, in: scope)
        return unhosted
    }

    @Test
    func `an empty answer is held at the commit it was measured against`() {
        let unhosted = Self.answered(at: "c0ffee")

        #expect(unhosted.answeredNothing(forBranch: Self.branch, at: "c0ffee", in: Self.scope))
    }

    @Test
    func `an empty answer measured against no commit is held for nothing`() {
        let unhosted = Self.answered(at: nil)

        #expect(!unhosted.answeredNothing(forBranch: Self.branch, at: nil, in: Self.scope))
    }

    @Test
    func `a pull request clears the branch whatever state it is in`() {
        var unhosted = Self.answered(at: "c0ffee")
        unhosted.record(
            .merged(number: 1620), ofBranch: Self.branch, at: "c0ffee", in: Self.scope,
        )

        #expect(!unhosted.answeredNothing(forBranch: Self.branch, at: "c0ffee", in: Self.scope))
    }

    @Test
    func `a branch left out of what is kept is forgotten`() {
        // The worktree was reaped, or the branch is now on the in-flight listing.
        var unhosted = Self.answered(at: "c0ffee")
        unhosted.keep([], in: Self.scope)

        #expect(!unhosted.answeredNothing(forBranch: Self.branch, at: "c0ffee", in: Self.scope))
    }

    @Test
    func `a branch reaped and cut again at the same commit is asked about`() {
        // Nothing survives the gap, so the recreated worktree buys its own answer rather than
        // inheriting one taken before the branch left.
        var unhosted = Self.answered(at: "c0ffee")
        unhosted.keep([], in: Self.scope)
        unhosted.keep([Self.branch], in: Self.scope)

        #expect(!unhosted.answeredNothing(forBranch: Self.branch, at: "c0ffee", in: Self.scope))
    }

    @Test
    func `keeping one scope's branches forgets every other scope`() {
        // A derivation re-pointed at another repository must not answer from the old one's, and the
        // map must not grow for the life of the window either.
        var unhosted = Self.answered(at: "c0ffee")
        unhosted.keep([Self.branch], in: "acme/web")

        #expect(!unhosted.answeredNothing(forBranch: Self.branch, at: "c0ffee", in: Self.scope))
    }

    @Test
    func `a branch that is kept keeps its answer`() {
        var unhosted = Self.answered(at: "c0ffee")
        unhosted.keep([Self.branch], in: Self.scope)

        #expect(unhosted.answeredNothing(forBranch: Self.branch, at: "c0ffee", in: Self.scope))
    }
}
