@testable import ArgoUI

/// What a suite hands `FeedAgents.told(_:by:at:)` when only ONE half of the evidence is the claim
/// under test. Here rather than on the value itself: the shipping type takes both closures for a
/// reason — a default would be a reader quietly answering "nothing" — and a fixture saying so out
/// loud is not that.
extension SubagentEvidence {
    /// The growth reading alone, said about every child. What the writing and ceiling suites state.
    static func watching(_ writing: SubagentWriting) -> SubagentEvidence {
        SubagentEvidence(
            writing: { _ in writing },
            ending: { _ in .open },
            measure: { _ in .unmeasured },
        )
    }

    /// One measure, said about every child. What the meter suites state.
    static func measuring(_ measure: SubagentMeasure) -> SubagentEvidence {
        SubagentEvidence(
            writing: { _ in .quiet },
            ending: { _ in .open },
            measure: { _ in measure },
        )
    }
}
