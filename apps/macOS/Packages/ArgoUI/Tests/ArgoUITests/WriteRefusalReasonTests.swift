import ArgoEngine
@testable import ArgoUI
import Testing

/// The one line a write control says when a write did not land — the real reason, never a
/// paraphrase (`cockpit-failure-states-spec.md` §5).
@Suite("Write refusal reason")
struct WriteRefusalReasonTests {
    /// The clause the rule exists for: what the provider said reaches the reader unedited, because
    /// its own sentence is usually the only thing that says how to fix it.
    @Test
    func `the provider's own words are rendered verbatim`() {
        let words = "Issues are disabled for this repository."

        #expect(WorkItemWriteError.refused(words).reason == words)
    }

    @Test
    func `a write the provider does not offer names the write`() {
        #expect(
            WorkItemWriteError.unavailable(.labels).reason
                == "This provider does not support labels",
        )
    }

    @Test
    func `a status the provider cannot express names the status`() {
        #expect(
            WorkItemWriteError.inexpressible(.inReview).reason
                == "This provider has no status for in review",
        )
    }

    @Test
    func `a transition the provider has no edge for names both ends`() {
        let refusal = WorkItemWriteError.illegalTransition(from: .todo, to: .done)

        #expect(refusal.reason == "This provider will not move a ticket from todo to done")
    }

    /// The cause word is the chip's own (`ConnectionCause.readableName`), so the control and the
    /// chip say one word about one connection rather than coining a second vocabulary.
    @Test
    func `a write that never reached the provider carries the chip's cause word`() {
        #expect(
            WorkItemWriteError.unreachable(.rateLimited).reason
                == "The write did not land — rate limited",
        )
    }

    /// The one `ProviderFetchError` with no cause: it is an Account fact, and the chip escalates it
    /// past the roll-up rather than wording it as a cause (§2).
    @Test
    func `a refused token is worded as the account fact it is`() {
        #expect(
            WorkItemWriteError.unreachable(.grantRefused).reason
                == "The account's token was refused",
        )
    }

    @Test
    func `every write has a noun to be refused by`() {
        for write in WorkItemWrite.allCases {
            #expect(!WorkItemWriteError.unavailable(write).reason.isEmpty)
        }
    }

    @Test
    func `every canonical status has a word to be inexpressible in`() {
        for state in WorkItemCanonicalState.allCases {
            #expect(!WorkItemWriteError.inexpressible(state).reason.isEmpty)
        }
    }
}
