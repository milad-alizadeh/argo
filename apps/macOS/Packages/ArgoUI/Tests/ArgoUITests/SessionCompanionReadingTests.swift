import ArgoEngine
@testable import ArgoUI
import Testing

/// What the ⓘ panel says about the companion channel (#493). The four states are asserted here
/// rather than looked at because a popover never lands in a screenshot.
@Suite("Session companion reading")
struct SessionCompanionReadingTests {
    /// Every state answers, or fails here: a fifth added to the domain cannot inherit whichever
    /// reading the mapping happens to end on.
    @Test
    func `every state has a reading, and only one of them is silent`() {
        let readings = CompanionLiveness.allCases.map(SessionHeaderProjection.companion(for:))

        #expect(readings.filter { $0 == nil }.count == 1)
        #expect(SessionHeaderProjection.companion(for: .notApplicable) == nil)
    }

    @Test
    func `a live channel reads live, and spends no sentence saying so`() {
        #expect(Self.reading(.live) == "Live")
    }

    /// The state a spawn starts in. It says the channel has nothing on it YET, which is a different
    /// claim from one that went.
    @Test
    func `a channel nothing has dialled says nothing has reported over it`() throws {
        let reading = try #require(Self.reading(.neverDialled))

        #expect(reading.hasPrefix("Not dialled in") == true)
        #expect(reading.contains("yet to report") == true)
    }

    /// The criterion that a dropped channel says what is LOST with it. The word alone would leave
    /// a reader unable to tell a lost channel from a Session that never had one.
    @Test
    func `a dropped channel says what stops arriving with it`() throws {
        let reading = try #require(Self.reading(.dropped))

        #expect(reading.hasPrefix("Dropped") == true)
        #expect(reading.contains("stops updating") == true)
        #expect(reading.contains("falls back to a reading of the transcript") == true)
    }

    @Test
    func `a managed Session's panel carries the row, under Access`() {
        let facts = SessionHeaderProjection.facts(from: Self.session(.dropped, access: .orphaned))

        #expect(Array(facts.map(\.term).suffix(2)) == ["Access", "Companion"])
    }

    /// An external Session renders NOTHING rather than a negative claim: it was never going to
    /// have a channel, and a row saying so on every such Session trains the reader past the one
    /// row that means something.
    @Test
    func `an external Session's panel has no companion row at all`() {
        let facts = SessionHeaderProjection.facts(from: Self.session(
            .notApplicable,
            access: .external,
        ))

        #expect(!facts.map(\.term).contains("Companion"))
    }

    /// A managed Session whose CLI takes no companion plugin is in the same position, and the
    /// panel treats it the same way: the reading is about the CHANNEL, not about the posture.
    @Test
    func `a managed Session with no channel has no companion row either`() {
        let facts = SessionHeaderProjection.facts(from: Self.session(
            .notApplicable,
            access: .managed,
        ))

        #expect(!facts.map(\.term).contains("Companion"))
    }

    private static func reading(_ liveness: CompanionLiveness) -> String? {
        SessionHeaderProjection.companion(for: liveness)
    }

    private static func session(
        _ liveness: CompanionLiveness,
        access: CockpitPresentation.Session.Access,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "companion-\(liveness)",
            title: "Say whether the companion channel is live",
            access: access,
            status: .idle,
            chain: .init(cli: .claude, model: "claude-opus-5", companionChannel: liveness),
        )
    }
}
