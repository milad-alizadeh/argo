import ArgoEngine
@testable import ArgoUI
import Testing

/// What the ⓘ panel says about the companion channel (#493), asserted rather than looked at
/// because a popover never lands in a screenshot.
@Suite("Session companion reading")
struct SessionCompanionReadingTests {
    /// One row per state and what it reads, `nil` where the panel draws nothing. `allCases`, so a
    /// fifth state added to the domain has to decide its reading here.
    struct Case: Sendable {
        let liveness: CompanionLiveness
        let reading: String?
    }

    static let cases: [Case] = [
        Case(liveness: .live, reading: "Live"),
        Case(
            liveness: .neverDialled,
            reading: "Not dialled in — this Session has yet to report anything of its own",
        ),
        // The criterion that a dropped channel says what is LOST with it: which facts stop
        // arriving, and what the status falls back to.
        Case(
            liveness: .dropped,
            reading: "Dropped — what this Session says about itself stops updating, "
                + "and its status falls back to a reading of the transcript",
        ),
        // The state that renders NOTHING rather than a negative claim.
        Case(liveness: .notApplicable, reading: nil),
    ]

    @Test(arguments: cases)
    func `each state reads as the panel words it`(state: Case) {
        #expect(SessionHeaderProjection.companion(for: state.liveness) == state.reading)
    }

    @Test
    func `every state of the channel has an answer here`() {
        #expect(Self.cases.map(\.liveness) == CompanionLiveness.allCases)
    }

    /// The row lands under `Access`, and only where there is a channel to report on. An orphaned
    /// Session is the one that has both, which is why it is the posture asserted.
    @Test
    func `the row sits under Access on a Session with a channel`() {
        let facts = SessionHeaderProjection.facts(from: Self.session(.dropped, access: .orphaned))

        #expect(Array(facts.map(\.term).suffix(2)) == ["Access", "Companion"])
    }

    /// Both ways to have no channel — never Argo's, and Argo's own CLI that takes no plugin — draw
    /// no row at all. The reading is about the CHANNEL, never about the posture.
    @Test(arguments: [
        CockpitPresentation.Session.Access.external,
        CockpitPresentation.Session.Access.managed,
    ])
    func `a Session with no channel has no companion row`(
        access: CockpitPresentation.Session.Access,
    ) {
        let facts = SessionHeaderProjection.facts(from: Self.session(
            .notApplicable,
            access: access,
        ))

        #expect(!facts.map(\.term).contains("Companion"))
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
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                companionChannel: liveness,
            ),
        )
    }
}
