import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The count wrong the other way (#1269): the rail said `0 running` and drew the quiet dot on two
/// delegations whose feeds the reader could open and watch move.
///
/// A parent that has handed its whole fan-out over and is now waiting on it writes nothing, so its
/// status reads `idle` — and `idle` used to mean `notRunning`, so every pending delegation under it
/// read finished. What settles it instead is `SubagentWriting`. Where that evidence meets
/// `DelegationCeiling` is `FeedAgentsCeilingTests`, the suite that owns the ceiling.
@Suite("Feed agents writing")
@MainActor
struct FeedAgentsWritingTests {
    /// The bug, in one claim: a chip Argo can watch its child writing is drawn running, whatever
    /// the parent's status says.
    @Test
    func `a delegation whose own transcript is growing is running under an idle parent`() {
        let chips = Self.listing(of: .idle, writing: [Self.child])

        #expect(chips.map(\.activity) == [.running])
        #expect(FeedAgents.running(of: chips) == 1)
    }

    /// The count line and the dots come off ONE array, so the header cannot disagree with the feed
    /// a chip under it opens (#1204).
    @Test
    func `the header counts the same answer the chips are drawn from`() {
        let listing = AgentsRailListing(
            of: Self.listing(of: .idle, writing: [Self.child]),
            scopedOnto: nil,
        )

        #expect(listing.running == 1)
        #expect(listing.listed.map(\.activity) == [.running])
        #expect(listing.finished.isEmpty)
    }

    /// #1076 still holds. A delegation nothing is writing, under a Session that has GONE, is not
    /// called live — and it is called finished rather than unknown, because a Session that has gone
    /// is evidence and not a gap.
    @Test
    func `a delegation nobody is writing under a session that has gone is finished`() {
        for status in [SessionStatus.stopped, .ended, .unknown] {
            #expect(Self.listing(of: status).map(\.activity) == [.finished], "\(status)")
        }
    }

    /// And the state the ticket asks for where the evidence runs out: an open delegation under a
    /// Session whose silence says nothing, with no child bytes to settle it, is UNKNOWN. The rail
    /// says so rather than picking `finished` — and it draws no colour for it, because the visual
    /// contract has none for "we cannot say".
    @Test
    func `a delegation the evidence cannot place is drawn unknown`() {
        let chips = Self.listing(of: .idle)

        #expect(chips.map(\.activity) == [.unknown])
        #expect(chips.map(\.activity.dot) == [nil])
        #expect(FeedAgents.running(of: chips) == 0)
    }

    /// An unknown chip is not filed behind a control counting FINISHED work: it stays in the
    /// column, where the reader can open it and see for themselves.
    @Test
    func `an unknown chip stays in the column`() {
        let listing = AgentsRailListing(of: Self.listing(of: .idle), scopedOnto: nil)

        #expect(listing.listed.map(\.activity) == [.unknown])
        #expect(listing.finished.isEmpty)
    }

    /// One-directional, exactly as `DelegationCeiling` is. Growth only ever GIVES a running claim
    /// — a delegation the record CLOSED stays closed, whatever a trailing byte in the child's file
    /// says.
    @Test
    func `growth does not reopen a delegation the record answered`() {
        let answered = [FeedAgent(
            id: 0,
            label: "done",
            activity: .finished,
            spend: nil,
            handover: FeedCall.Handover(subagentID: Self.child),
        )]

        #expect(FeedAgents.told(answered, by: .watching(.writing)).map(\.activity) == [.finished])
    }

    /// Nor does it reach a Session that has gone: that reading is `finished` for a reason the
    /// child's bytes do not touch — nothing is left to write the report that would close the call.
    @Test
    func `growth does not raise a delegation under a session that has gone`() {
        #expect(Self.listing(of: .ended, writing: [Self.child]).map(\.activity) == [.finished])
    }

    // MARK: - Fixtures

    /// The one Subagent this suite has a reading of.
    private static let child = "a-away"

    /// One backgrounded delegation, its receipt filed and no report behind it — the shape every
    /// chip in the Session this ticket was written from takes.
    private static let launched: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Agent", kind: .delegate, naming: "review")),
        .toolCallOutcome(TranscriptFixtures.launched("away", subagent: child)),
    ]

    /// The child's own record, left MID-TOOL: this suite's claims are about growth and the parent's
    /// status, so the reading has to be one that settles neither by itself. A record ending in
    /// prose would be the child saying it had stopped, which is `SubagentEndingTests`' subject
    /// (#1392) and would answer every chip here before the evidence under test was reached.
    private static func readings(writing: Set<String> = []) -> FeedAgentReader {
        FeedAgentReader(
            events: [child: [.toolCall(FeedFixture.call("dig", tool: "Bash", kind: .execute))]],
            growth: StatedGrowth(writing: writing),
        )
    }

    /// The rail's list as the shell derives it: through the reader, stamped with a reading of a
    /// Session at this status.
    private static func listing(
        of status: SessionStatus,
        writing: Set<String> = [],
    )
        -> [FeedAgent] {
        SessionsRoomReadingCache.forget()
        let reading = reading(of: status)
        return readings(writing: writing).stamped(reading.stamp).agents(in: reading.feed)
    }

    private static func reading(of status: SessionStatus) -> SessionsRoomReading {
        SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [CockpitPresentation.Session(
                    id: "one",
                    title: "one",
                    access: .managed,
                    status: status,
                    transcript: .init(events: launched),
                )],
                connection: .idle,
            ),
            sessionID: "one",
        )
    }
}
