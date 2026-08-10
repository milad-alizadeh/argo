@testable import ArgoUI
import Testing

/// Whether the header offers to hand a Session off — the eligibility rule, asserted where it is
/// made.
///
/// Its own suite beside the context one because it is a DIFFERENT rule over the same reading: the
/// tier decides ink, and this decides whether a control exists at all. #502 asks for exactly one
/// assertion by name — handing off is offered for managed-and-past-WARN and withheld for external
/// and orphaned at the same reading — and a rule with two inputs is only proved by holding one of
/// them still.
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

    /// Story 44. A permanent control trains you to ignore it, so under the line there is no button
    /// at all — not a disabled one, which is still a control on every header.
    @Test
    func `under the warning line there is no button of any kind`() {
        #expect(header(tokens: 67175).handoff == nil)
        #expect(header(tokens: 149_999).handoff == nil)
        // Exactly at the line it appears, which is the same boundary the reading changes on: a
        // button that arrived a token later would be amber ink beside no remedy.
        #expect(header(tokens: 150_000).handoff != nil)
    }

    /// Story 39's sibling. A context Argo could not read is not a context past a line — the offer
    /// degrades to absent rather than to the nearest guess.
    @Test
    func `a Session whose context could not be read is offered nothing`() {
        #expect(header(tokens: nil).handoff == nil)
    }

    /// Story 49, and the assertion #502 names. Both read-only postures, at a reading that WOULD
    /// have earned the button on a managed Session — so what is being proved is the access half of
    /// the rule and not the tier half.
    @Test
    func `an external or orphaned Session gets the warning and no button`() {
        for access in [CockpitPresentation.Session.Access.external, .orphaned] {
            let header = header(tokens: Self.pastWarn, access: access)

            // The warning is still there: Argo cannot type into this terminal, which is a fact
            // about the remedy and not about how full the Session is.
            #expect(header.context.tier == .warn)
            #expect(header.handoff == nil)
        }
    }

    /// The whole rule in one table, over both axes at once — so a posture added to the access enum
    /// or a tier added to the reading has to answer here rather than inheriting a branch.
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

    /// Story 45. The button's urgency is the READING's tier and not a second judgement, so the two
    /// cannot drift into two alarms about one number.
    @Test
    func `the button wears the tier of the reading beside it`() throws {
        let warned = try #require(header(tokens: Self.pastWarn).handoff)
        let critical = try #require(header(tokens: Self.pastCrit).handoff)

        #expect(warned.tier == .warn)
        #expect(critical.tier == .crit)
        #expect(warned.tier == header(tokens: Self.pastWarn).context.tier)
        #expect(critical.tier == header(tokens: Self.pastCrit).context.tier)
    }

    /// Story 46. One sentence, saying what the control DOES — the argument for handing off is the
    /// ⓘ panel's and is already made there.
    @Test
    func `the button carries one sentence and no caption`() throws {
        let handoff = try #require(header(tokens: Self.pastWarn).handoff)

        #expect(handoff.detail.split(separator: ".").count == 1)
        #expect(handoff.detail.contains("/handoff"))
        #expect(handoff.detail.contains("same branch and issue"))
        // The label is the verb and nothing else: a caption under a button is the third telling of
        // a fact the reading and the panel have already made.
        #expect(handoff.label.count < 12)
    }

    /// The AC that says a handoff which cannot be launched is DISABLED with a reason rather than
    /// silently nothing. The reachable value-level case is a Session with no folder to start one
    /// beside — Argo would have to invent a working directory, and it does not.
    @Test
    func `a Session with no folder shows the button disabled and says why`() throws {
        let handoff = try #require(
            SessionHeaderProjection.header(from: CockpitPresentation.Session(
                id: "folderless",
                title: "Session",
                model: "claude-opus-5",
                workspaceLocation: nil,
                access: .managed,
                status: .idle,
                contextTokens: Self.pastWarn,
            )).handoff,
        )

        #expect(!handoff.isLaunchable)
        #expect(try #require(handoff.blocked).contains("folder"))
    }

    /// The PNGs are the only evidence these renderings have, and a state with no case in the
    /// catalog is a state that ships without anybody looking at it.
    @Test
    func `every state of the offer has a specimen of its own`() {
        let drawn = SessionHeaderFixture.handoffs

        #expect(drawn.map(\.specimen) == [
            .handoffWithheld,
            .handoffAtWarn,
            .handoffAtCrit,
            .handoffOnReadOnly,
            .handoffOnOrphaned,
        ])
        #expect(drawn.map(\.header.handoff?.tier) == [nil, .warn, .crit, nil, nil])
    }

    private func header(
        tokens: Int?,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: CockpitPresentation.Session(
            id: "session",
            title: "Session",
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            access: access,
            status: .idle,
            cli: .claude,
            workspace: .init(branch: "main"),
            contextTokens: tokens,
        ))
    }
}
