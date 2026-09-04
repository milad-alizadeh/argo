import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// What the roster's leading column says runs under a Session (#1344).
///
/// The claim the whole suite rests on is the first one: the roster and the Agents rail read one
/// list through one rule, so they cannot disagree about one Session. A roster indicator that
/// repeats #1269 repeats it on every row at once.
@Suite("The roster's Subagent dots")
struct RosterDelegationTests {
    @Test
    func `the row's count is the count the rail draws for the same Session`() throws {
        let events = Self.handedOver(open: 3, landed: 2)
        let session = Self.session(status: .running, events: events)

        let rail = FeedAgents.running(of: FeedAgents.all(
            in: FeedProjection.rows(from: events), of: .running,
        ))
        let row = try #require(SessionRosterProjection.rows(from: [session]).first)

        #expect(rail == 3)
        #expect(row.delegation == .running(rail))
    }

    /// The ceiling, and the exact figure past it: five is where a stack stops being countable at a
    /// glance, and a longer stack is texture.
    @Test
    func `twelve running draws five dots and says the other seven`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            Self.session(status: .running, events: Self.handedOver(open: 12, landed: 0)),
        ]).first)

        #expect(row.delegation == .running(12))
        #expect(SubagentDots.ceiling == 5)
    }

    /// The three readings that are NOT a count, told apart. Never-delegated and all-home look alike
    /// and are two facts: a column that answered both with a blank would say a Session that fanned
    /// out and gathered everyone back never fanned out.
    @Test
    func `never delegated, all home and cannot resolve are three different readings`() throws {
        let never = try #require(SessionRosterProjection.rows(from: [
            Self.session(status: .running, events: []),
        ]).first)
        let home = try #require(SessionRosterProjection.rows(from: [
            Self.session(status: .running, events: Self.handedOver(open: 0, landed: 3)),
        ]).first)
        // An idle Session writes nothing while it waits, so its open delegation is
        // indistinguishable in the record from a dead one's (#1076).
        let cannotSay = try #require(SessionRosterProjection.rows(from: [
            Self.session(status: .idle, events: Self.handedOver(open: 2, landed: 0)),
        ]).first)

        #expect(never.delegation == .none)
        #expect(home.delegation == .spent)
        #expect(cannotSay.delegation == .unresolved)
    }

    /// A Session Argo cannot place cannot be claimed to be delegating either, and the state's own
    /// outline already carries the whole claim — a second outline under it reads as a second dot.
    @Test
    func `a Session whose own state Argo cannot place claims nothing under it`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [
            Self.session(
                status: .unknown, access: .external, events: Self.handedOver(open: 4, landed: 0),
            ),
        ]).first)

        #expect(row.state == nil)
        #expect(row.delegation == .none)
    }

    /// The child's own file is the evidence the parent's record does not hold (#1269): it lifts a
    /// delegation Argo could not otherwise place, on the roster exactly as on the rail.
    @Test
    func `a child Argo has watched writing is running on the roster too`() throws {
        let events = Self.handedOver(open: 2, landed: 0, answering: "child-0")
        let writing = try #require(SessionRosterProjection.rows(
            from: [Self.session(status: .idle, events: events)],
            viewing: .init(writing: { $0 == "child-0" ? .writing : .quiet }),
        ).first)

        // Without the file this is the honest `unresolved` above. With it, one child is
        // demonstrably up — and Argo counts what it can place rather than letting the one it
        // cannot speak for both.
        #expect(writing.delegation == .running(1))
    }

    /// Rule 9: a fold sums or it says nothing.
    @Test
    func `a fold sums the runs it hides`() throws {
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            Self.session(
                id: "headless-\(index)",
                status: .running,
                access: .external,
                entry: .headless,
                events: Self.handedOver(open: 2, landed: 1),
            )
        }).first { $0.fold != nil })

        #expect(fold.delegation == .running(6))
    }

    /// A fold whose every member is a reading Argo cannot place has no total to draw, so it draws
    /// the outline rather than a zero.
    @Test
    func `a fold that can place none of its runs draws no total`() throws {
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            Self.session(
                // Idle, so an open delegation under it is the #1076 shape.
                id: "headless-\(index)", status: .idle, access: .external, entry: .headless,
                events: Self.handedOver(open: 2, landed: 0),
            )
        }).first { $0.fold != nil })

        #expect(fold.delegation == .unresolved)
    }

    /// And a fold that can place SOME of them draws those: the outline is what is left when Argo
    /// can place nothing, never a claim that outranks evidence it holds.
    @Test
    func `a fold draws the runs it can place beside the ones it cannot`() throws {
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            Self.session(
                id: "headless-\(index)",
                status: index == 2 ? .idle : .running,
                access: .external,
                entry: .headless,
                events: Self.handedOver(open: 2, landed: 0),
            )
        }).first { $0.fold != nil })

        #expect(fold.delegation == .running(4))
    }

    // MARK: - the fixture

    /// `open` delegations the record has not answered, then `landed` ones it has. `answering` names
    /// the Subagent id the record reports for the first open one, which is what a growth reading is
    /// keyed by.
    private static func handedOver(open: Int, landed: Int, answering: String? = nil)
        -> [TranscriptEvent] {
        var events: [TranscriptEvent] = []
        for index in 0 ..< open {
            events.append(.toolCall(FeedFixture.call(
                "open-\(index)", tool: "Task", kind: .delegate, naming: "brief \(index)",
            )))
            // A backgrounded launch is answered AT ONCE by a receipt that resolves nothing (#908),
            // which is what gives a still-running child an id to be keyed by.
            if let answering, index == 0 {
                events.append(.toolCallOutcome(ToolCallOutcome(
                    id: "open-0",
                    resolution: .init(status: .pending, result: nil, endedAtMs: nil),
                    delegated: .init(usage: nil, subagentID: answering),
                )))
            }
        }
        for index in 0 ..< landed {
            events.append(.toolCall(FeedFixture.call(
                "home-\(index)", tool: "Task", kind: .delegate, naming: "done \(index)",
            )))
            events.append(.toolCallOutcome(TranscriptFixtures.finished("home-\(index)", nil)))
        }
        return events
    }

    private static func session(
        id: String = "one",
        status: SessionStatus,
        access: CockpitPresentation.Session.Access = .managed,
        entry: SessionEntry = .interactive,
        events: [TranscriptEvent],
    )
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(
            id: id, access: access, entry: entry, status: status, lastSeenAtMs: 0, events: events,
        )
    }
}
