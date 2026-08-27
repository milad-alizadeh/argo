@testable import ArgoEngine
import Foundation
import Testing

/// The canonical state bucket, and the blocker rule that decides whether a ticket can be picked
/// up (#167, `CONTEXT.md` L1 · Work Item).
@Suite("Work Item state")
struct WorkItemStateTests {
    @Test(arguments: [
        (WorkItemClosure.open, false, WorkItemState.open),
        (.open, true, .claimed),
        (.resolved, false, .resolved),
        (.ruledOut, false, .ruledOut),
        // A closure nobody could read still closed the ticket, and resolved is the answer that
        // keeps a dependent map moving.
        (.closedUnreadably, false, .resolved),
    ])
    func `a closure and a claim settle the bucket`(
        closure: WorkItemClosure, claimed: Bool, bucket: WorkItemState,
    ) {
        #expect(WorkItemState(closure: closure, claimed: claimed) == bucket)
    }

    @Test
    func `a ticket closed while a Session holds it reads closed rather than claimed`() {
        // The provider's answer outranks Argo's: a claim that survived closure would leave the
        // room advertising work that is already done.
        #expect(WorkItemState(closure: .resolved, claimed: true) == .resolved)
    }

    @Test
    func `a ticket with no blockers is clear`() {
        #expect(WorkItemBlockage(blockers: []) == .clear)
    }

    @Test
    func `a ticket whose every blocker was completed is clear`() {
        let blockers = [WorkItemBlocker(number: 1, closure: .resolved)]

        #expect(WorkItemBlockage(blockers: blockers) == .clear)
    }

    @Test
    func `an open blocker blocks`() {
        let blockers = [
            WorkItemBlocker(number: 1, closure: .resolved),
            WorkItemBlocker(number: 2, closure: .open),
        ]

        #expect(WorkItemBlockage(blockers: blockers) == .blocked)
    }

    @Test
    func `a blocker that was ruled out strands its dependent`() {
        // Argo disagrees with the GitHub and Linear UIs, which count a cancelled blocker as
        // satisfied: the dependent's premise was cancelled and a human owes a decision.
        let blockers = [WorkItemBlocker(number: 1, closure: .ruledOut)]

        #expect(WorkItemBlockage(blockers: blockers) == .stranded)
    }

    @Test
    func `a stranding blocker outranks one that is merely open`() {
        let blockers = [
            WorkItemBlocker(number: 1, closure: .open),
            WorkItemBlocker(number: 2, closure: .ruledOut),
        ]

        // Blocked clears itself as work lands; stranded never will, so it is the one to say.
        #expect(WorkItemBlockage(blockers: blockers) == .stranded)
    }

    @Test
    func `a blocker closed for a reason nothing can read satisfies its edge`() {
        // The degradation is asymmetric on purpose: a port that cannot read closure kinds produces
        // a chrome notice, never a tree of stranded tickets.
        let blockers = [WorkItemBlocker(number: 1, closure: .closedUnreadably)]

        #expect(WorkItemBlockage(blockers: blockers) == .clear)
    }
}
