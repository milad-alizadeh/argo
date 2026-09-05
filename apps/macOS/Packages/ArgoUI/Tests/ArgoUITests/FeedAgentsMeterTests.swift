import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The empty meter under a finished background chip (#1279).
///
/// A backgrounded delegation reports neither figure at either end (#908), so both slots under its
/// name were blank for the life of the record — the two review chips in the request's screenshot.
/// The child's OWN file, which Argo already holds (#858), states both.
@Suite("Feed agents meter")
@MainActor
struct FeedAgentsMeterTests {
    private typealias Fixture = FeedAgentsMeterFixture

    /// The bug, in one claim.
    @Test
    func `a finished background chip states its child's own time and tokens`() {
        let chips = Fixture.listing(of: .ended, reading: Fixture.ran)

        #expect(chips.map(\.activity) == [.finished])
        #expect(chips.first?.durationMs == 12000)
        #expect(chips.first?.spend?.spentTokens == 5600)
    }

    /// The running half: tokens read SO FAR are tokens spent so far, and that figure only grows. No
    /// duration, though — the chip is still counting up, and a total measured to here would replace
    /// a live clock with a frozen one (#1076, #1090).
    @Test
    func `a running background chip shows tokens and keeps counting up`() {
        let chips = Fixture.listing(of: .idle, reading: Fixture.ran, writing: [Fixture.child])

        #expect(chips.map(\.activity) == [.running])
        #expect(chips.first?.durationMs == nil)
        #expect(chips.first?.startedAtMs != nil)
        #expect(chips.first?.spend?.spentTokens == 5600)
    }

    /// Degrade down. A chip whose child Argo has not read draws an empty meter, which is the honest
    /// state — a `0` would claim the work was instant and free.
    @Test
    func `a chip with no reading measures nothing`() {
        let chips = Fixture.listing(of: .ended, reading: [])

        #expect(chips.first?.durationMs == nil)
        #expect(chips.first?.spend == nil)
    }

    /// DERIVED never outranks DIRECT. A synchronous agent's host-measured pair is what the host
    /// itself observed of the run, and it stands whatever the child's own file spans.
    @Test
    func `a reported total wins over the derived one`() {
        let reported = FeedAgent(
            id: 0,
            label: "verified",
            activity: .finished,
            spend: Usage(
                inputTokens: 1,
                outputTokens: 2,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            ),
            handover: FeedCall.Handover(subagentID: Fixture.child, durationMs: 99, startedAtMs: 5),
        )

        let told = FeedAgents.told([reported], by: .measuring(Fixture.measured))

        #expect(told.first?.durationMs == 99)
        #expect(told.first?.spend?.spentTokens == 3)
        #expect(told.first?.startedAtMs == 5)
    }

    /// The two are filled independently: a record that stated one of them still gets the other.
    @Test
    func `a reported duration does not withhold a derived spend`() {
        let half = FeedAgent(
            id: 0,
            label: "half",
            activity: .finished,
            spend: nil,
            handover: FeedCall.Handover(subagentID: Fixture.child, durationMs: 99),
        )

        let told = FeedAgents.told([half], by: .measuring(Fixture.measured))

        #expect(told.first?.durationMs == 99)
        #expect(told.first?.spend?.spentTokens == 5600)
    }

    /// A chip whose record stated ALL THREE figures asks the reading nothing — the guard
    /// `FeedAgent.wantsMeasuring` is, spelled once and read by the reader and the fold alike.
    @Test
    func `a fully reported chip is never measured`() {
        let whole = FeedAgent(
            id: 0,
            label: "whole",
            activity: .finished,
            spend: Usage(
                inputTokens: 1,
                outputTokens: 2,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            ),
            handover: FeedCall.Handover(subagentID: Fixture.child, durationMs: 99, startedAtMs: 5),
        )
        var asked = 0

        let told = FeedAgents.told([whole], by: SubagentEvidence(
            writing: { _ in .quiet },
            measure: { _ in
                asked += 1
                return Fixture.measured
            },
        ))

        #expect(!whole.wantsMeasuring)
        #expect(asked == 0)
        #expect(told == [whole])
    }
}
