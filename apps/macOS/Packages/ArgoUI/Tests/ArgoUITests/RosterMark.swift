@testable import ArgoUI
import Testing

/// The roster's ONE selected state, read the way the sidebar reads it: the rows the list is
/// drawing, and the ground under exactly one of them.
///
/// Shared by every suite that asks where the window is pointing after something outside the roster
/// pointed it — the Tickets room's claimant line (#1273) and Start on a ticket (#1493). Two copies
/// of this reading would be two ideas of what "grounded" means, and an assertion would then hold
/// whichever one its own file happened to carry.
enum RosterMark {
    /// The expected id is NAMED, so a roster grounding the wrong row still fails.
    @MainActor
    static func expect(
        _ expected: String,
        in sessions: [CockpitPresentation.Session],
        for navigation: CockpitNavigationModel,
        sourceLocation: SourceLocation = #_sourceLocation,
    ) {
        let reading = RosterListing().reading(
            of: sessions,
            focus: .init(sessionID: navigation.session),
        )
        let selection = SessionRosterProjection.Selection(named: navigation.session)
        let grounded = reading.rows.filter { selection.isSelected($0) }

        #expect(
            grounded.map(\.id) == [expected],
            "The roster grounds no row, or two.",
            sourceLocation: sourceLocation,
        )
        #expect(
            navigation.session == grounded.first?.id,
            "The `List`'s own selection and the ground name two different rows.",
            sourceLocation: sourceLocation,
        )
    }
}
