import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The count wrong the other way (#1269): the rail said `0 running` and drew the quiet dot on two
/// delegations whose feeds the reader could open and watch move.
///
/// A parent that has handed its whole fan-out over and is now waiting on it writes nothing, so its
/// status reads `idle` — and `idle` used to mean `notRunning`, so every pending delegation under it
/// read finished. The record cannot settle that (#1076), but the record is not the only evidence:
/// Argo tails each child's own transcript (#858), and a file it has watched grow is DIRECT evidence
/// somebody is writing it.
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

    /// One-directional, exactly as `DelegationCeiling` is. Growth only ever settles an `unknown`
    /// chip — a delegation the record CLOSED stays closed, whatever a trailing byte in the child's
    /// file says.
    @Test
    func `growth does not reopen a delegation the record answered`() {
        let answered = [FeedAgent(
            id: 0,
            label: "done",
            activity: .finished,
            spend: nil,
            subagentID: Self.child,
        )]

        #expect(FeedAgents.told(answered) { _ in .writing }.map(\.activity) == [.finished])
    }

    /// Nor does it reach a Session that has gone: that reading is `finished` for a reason the
    /// child's bytes do not touch — nothing is left to write the report that would close the call.
    @Test
    func `growth does not raise a delegation under a session that has gone`() {
        #expect(Self.listing(of: .ended, writing: [Self.child]).map(\.activity) == [.finished])
    }

    /// A chip Argo has no id for has no file to watch, so it cannot be settled by one.
    @Test
    func `a chip with no subagent id is not settled by anybody's growth`() {
        let unnamed = [FeedAgent(id: 0, label: "out", activity: .unknown, spend: nil)]

        #expect(FeedAgents.told(unnamed) { _ in .quiet }.map(\.activity) == [.unknown])
    }

    /// The window, from both sides, against the constant and never against its literal. A figure
    /// restated here is the drift the constant exists to stop.
    @Test
    func `growth exactly at the window still reads as writing`() {
        let nowMs = 4_000_000_000

        #expect(SubagentWriting.read(
            lastGrewAtMs: nowMs - SubagentWriting.growthWindowMs,
            nowMs: nowMs,
        ) == .writing)
        #expect(SubagentWriting.read(
            lastGrewAtMs: nowMs - SubagentWriting.growthWindowMs - 1,
            nowMs: nowMs,
        ) == .quiet)
    }

    /// A file Argo never watched grow dates nothing, and absence of evidence settles nothing —
    /// which is what keeps the backfill of a long-dead child from lighting its chip up.
    @Test
    func `a child argo never watched grow is quiet`() {
        #expect(SubagentWriting.read(lastGrewAtMs: nil, nowMs: 4_000_000_000) == .quiet)
    }

    /// The whole seam, end to end, through the memo the shipping path takes: the walk is remembered
    /// under a stamp a child's bytes do not move (#858), so a growth reading held INSIDE it would
    /// freeze at whatever the child was doing when its parent last wrote. Asked twice at one stamp,
    /// the second answer still follows the child.
    @Test
    func `the memoised list still follows the child`() throws {
        SessionsRoomReadingCache.forget()
        let reading = Self.reading(of: .idle)
        let stamp = try #require(reading.stamp)
        let quiet = Self.readings().stamped(reading.stamp).agents(in: reading.feed)
        let told = Self.readings(writing: [Self.child]).stamped(reading.stamp)
            .agents(in: reading.feed)

        // The memo IS the thing under test, so it is asserted to be standing: without this the
        // case would pass on a cache that never held the walk at all.
        #expect(SessionsRoomReadingCache.agents(at: stamp)?.map(\.activity) == [.unknown])
        #expect(quiet.map(\.activity) == [.unknown])
        #expect(told.map(\.activity) == [.running])
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

    private static func readings(writing: Set<String> = []) -> FeedAgentReader {
        FeedAgentReader(
            events: [child: [.message(markdown: "still going")]],
            writing: writing,
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
                checkout: .unavailable,
                connection: .idle,
            ),
            sessionID: "one",
        )
    }
}
