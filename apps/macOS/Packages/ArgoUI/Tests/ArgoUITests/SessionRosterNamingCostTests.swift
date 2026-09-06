import ArgoEngine
@testable import ArgoUI
import Testing

/// What naming a roster COSTS the surfaces that draw off it, in whole-roster passes (ADR-0028 Rule
/// 8): a count and never the milliseconds, because a count is exactly the same idle and loaded.
///
/// #1557: the deck header asked for one Session's title, and answering it named every Session on
/// the roster — two listings, every fold folded, a rival set over the whole list — and then kept
/// one element. The sidebar paid the identical fold again in its own body. Three whole-roster
/// passes per window pass, for two surfaces, growing with the roster rather than staying flat.
///
/// The claim is ONE pass per roster, shared, and none at all on a pass the roster did not move in.
/// The last case is the other half and the one that matters more: a pass shared is a pass that must
/// still be retaken the moment a title's answer could differ.
@Suite("Session roster naming cost", .serialized)
@MainActor
struct SessionRosterNamingCostTests {
    /// The user's complaint, counted: both surfaces draw, one pass is taken.
    @Test
    func `the sidebar and the deck header share one naming pass`() {
        SessionRosterNamingMemo.forget()
        let sessions = Self.roster

        _ = RosterListing().reading(of: sessions)
        _ = SessionRosterProjection.namedTitle(for: "one", among: sessions)

        #expect(SessionRosterNamingMemo.cost.passes == 1)
    }

    /// `CockpitView.body` re-runs on any of its own state changes as well as on every presentation
    /// the Hub publishes, so a keystroke in the composer redraws both surfaces over a roster that
    /// did not move. It costs nothing.
    @Test
    func `a repeat pass over the same roster names nothing again`() {
        SessionRosterNamingMemo.forget()
        let sessions = Self.roster

        for _ in 0 ..< 4 {
            _ = RosterListing().reading(of: sessions)
            _ = SessionRosterProjection.namedTitle(for: "one", among: sessions)
        }

        #expect(SessionRosterNamingMemo.cost.passes == 1)
    }

    /// The key is answered by the roster's own storage while the shell hands the same published
    /// array every pass — which it does. A caller that started rebuilding the array would make
    /// every pass an element-by-element walk of the whole roster, and this is what sees that
    /// rather than letting it pass quietly.
    @Test
    func `a repeat pass walks no Session to answer the key`() {
        SessionRosterNamingMemo.forget()
        let sessions = Self.roster

        _ = RosterListing().reading(of: sessions)
        _ = RosterListing().reading(of: sessions)

        #expect(SessionRosterNamingMemo.cost.compared == 0)
    }

    /// The half a shared pass may not break: a roster that MOVED is named again. Two rows on one
    /// Ticket each take their derived name (#1072); take one away and the survivor is the only row
    /// the Ticket names, so it spends the Ticket's words — and a memo holding the first answer
    /// would leave the header drawing a title no row has.
    @Test
    func `a roster that moved is named again, and the title moves with it`() {
        SessionRosterNamingMemo.forget()
        let rivals = Self.roster

        let contested = SessionRosterProjection.namedTitle(for: "one", among: rivals)
        let alone = SessionRosterProjection.namedTitle(for: "one", among: [rivals[0]])

        #expect(contested == "Write a caption for one folder")
        #expect(alone == "Rough atlas for Argo itself")
        #expect(SessionRosterNamingMemo.cost.passes == 2)
    }

    /// Two Sessions on one Ticket, which is the roster whose titles depend on the whole list.
    private static let roster = [
        RosterSessionFixture.session(
            id: "one", title: "Write a caption for one folder", ticket: .linked(atlas),
        ),
        RosterSessionFixture.session(
            id: "two", title: "These two files change together", ticket: .linked(atlas),
        ),
    ]

    private static let atlas = CockpitPresentation.Session
        .Issue(number: 650, title: "Rough atlas for Argo itself")
}
