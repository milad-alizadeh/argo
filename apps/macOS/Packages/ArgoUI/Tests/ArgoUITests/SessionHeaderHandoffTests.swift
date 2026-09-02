import ArgoEngine
@testable import ArgoUI
import Testing

/// Whether the header offers to hand a Session off — the eligibility rule, asserted where it is
/// made (#502). The tier decides ink; this decides whether a control exists at all.
@Suite("Session header handoff")
struct SessionHeaderHandoffTests {
    private static let pastWarn = 216_764
    private static let pastCrit = 472_233

    /// Story 43. The remedy appears at the moment it becomes the right move.
    @Test
    func `a managed Session past the warning line is offered the handoff`() throws {
        let handoff = try #require(header(tokens: Self.pastWarn).handoff)

        #expect(handoff.label == "Hand off")
        #expect(handoff.isLaunchable)
    }

    /// Story 44. Under the line there is no button at all, not a disabled one.
    @Test
    func `under the warning line there is no button of any kind`() {
        #expect(header(tokens: 67175).handoff == nil)
        #expect(header(tokens: 149_999).handoff == nil)
        // Exactly at the line it appears — the same boundary the reading changes on.
        #expect(header(tokens: 150_000).handoff != nil)
    }

    /// Story 39's sibling. A context Argo could not read is not a context past a line — the offer
    /// degrades to absent rather than to the nearest guess.
    @Test
    func `a Session whose context could not be read is offered nothing`() {
        #expect(header(tokens: nil).handoff == nil)
    }

    /// Story 49, and the assertion #502 names. Both read-only postures, at a reading that WOULD
    /// have earned the button on a managed Session.
    @Test
    func `an external or orphaned Session gets the warning and no button`() {
        for access in [CockpitPresentation.Session.Access.external, .orphaned] {
            let header = header(tokens: Self.pastWarn, access: access)

            // The warning is still there: read-only is a fact about the remedy, not about how full
            // the Session is.
            #expect(header.context.tier == .warn)
            #expect(header.handoff == nil)
        }
    }

    /// The remedy is offered once. A Session that has already handed off keeps the coloured reading
    /// and loses the button — a second press would open a third Session on the same branch.
    @Test
    func `a Session that has handed off keeps the reading and loses the button`() {
        let header = header(tokens: Self.pastCrit, handedOffTo: "fresh-session")

        #expect(header.context.tier == .crit)
        #expect(header.handoff == nil)
    }

    /// The whole rule in one table, over both axes at once.
    @Test
    func `the offer is exactly managed-and-past-a-line`() {
        let offered = CockpitPresentation.Session.Access.allCases.map { access in
            [67175, Self.pastWarn, Self.pastCrit, nil].map {
                header(tokens: $0, access: access).handoff != nil
            }
        }

        #expect(offered == [
            [false, true, true, false],
            [false, false, false, false],
            [false, false, false, false],
        ])
    }

    /// Story 45. The button's urgency is the READING's tier and not a second judgement.
    @Test
    func `the button wears the tier of the reading beside it`() throws {
        let warned = try #require(header(tokens: Self.pastWarn).handoff)
        let critical = try #require(header(tokens: Self.pastCrit).handoff)

        #expect(warned.tier == .warn)
        #expect(critical.tier == .crit)
        #expect(warned.tier == header(tokens: Self.pastWarn).context.tier)
        #expect(critical.tier == header(tokens: Self.pastCrit).context.tier)
    }

    /// Story 46. One sentence, saying what the control DOES.
    @Test
    func `the button carries one sentence and no caption`() throws {
        let handoff = try #require(header(tokens: Self.pastWarn).handoff)

        #expect(handoff.detail.split(separator: ".").count == 1)
        #expect(handoff.detail.contains("/handoff"))
        #expect(handoff.detail.contains("same branch and issue"))
        // The label is the verb and nothing else.
        #expect(handoff.label.count < 12)
    }

    /// The press is answered in minutes, so the control has a second word for the time it is
    /// running, distinct from the resting one.
    @Test
    func `the button has a word for the minutes it is running`() throws {
        let handoff = try #require(header(tokens: Self.pastWarn).handoff)

        #expect(handoff.runningLabel != handoff.label)
        #expect(handoff.runningLabel == "Handing off…")
    }

    /// A handoff that cannot be launched is DISABLED with a reason rather than silently nothing.
    /// The reachable value-level case is a Session with no folder to start one beside.
    @Test
    func `a Session with no folder shows the button disabled and says why`() throws {
        let handoff = try #require(
            SessionHeaderProjection.header(from: CockpitPresentation.Session(
                id: "folderless",
                title: "Session",
                access: .managed,
                status: .idle,
                chain: .init(program: .init(model: "claude-opus-5")),
                spend: .init(contextTokens: Self.pastWarn),
            )).handoff,
        )

        #expect(!handoff.isLaunchable)
        // The tooltip on the disabled button and the alert reporting the same refusal are one
        // string.
        #expect(handoff.blocked == SessionHandoff.Failure.noFolder.detail)
    }

    /// The PNGs are the only evidence these renderings have.
    @Test
    func `every state of the offer has a specimen of its own`() {
        let drawn = SessionHeaderFixture.handoffs

        #expect(drawn.map(\.name) == [
            "handoffWithheld",
            "handoffAtWarn",
            "handoffAtCrit",
            "handoffOnReadOnly",
            "handoffOnOrphaned",
        ])
        #expect(drawn.map(\.header.handoff?.tier) == [nil, .warn, .crit, nil, nil])
        // The remedy taken is not an offer, so it is a fixture of its own: what is left on the red
        // header is the link rather than the button.
        #expect(SessionHeaderFixture.handedOff.handoff == nil)
    }

    private func header(
        tokens: Int?,
        access: CockpitPresentation.Session.Access = .managed,
        handedOffTo: String? = nil,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            access: access,
            status: .idle,
            chain: .init(
                program: .init(cli: .claude, model: "claude-opus-5"),
                handedOffTo: handedOffTo,
            ),
            work: .init(location: "/Users/milad/Developer/argo", workspace: .init(branch: "main")),
            spend: .init(contextTokens: tokens),
        ))
    }
}
