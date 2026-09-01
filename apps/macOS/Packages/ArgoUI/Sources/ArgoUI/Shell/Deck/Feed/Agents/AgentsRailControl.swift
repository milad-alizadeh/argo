import SwiftUI

/// The rail as a control, in one value: what the feed is scoped to, whether the rail is collapsed,
/// and the readings a chip can be scoped onto.
///
/// Bindings, because every one of the three is state the deck owns — the rail writes them and the
/// feed beside it reads them, which is what makes selecting an Agent re-scope one feed rather than
/// open a second.
struct AgentsRailControl {
    @Binding var scope: FeedScope
    /// Held ABOVE the deck's per-Session identity, beside the seam widths: keyed to the Session it
    /// would spring open again on every switch, and a reader who collapsed the rail meant the rail.
    @Binding var isCollapsed: Bool
    var readings = FeedAgentReader.unread

    /// A rail nothing has scoped and nobody can collapse — what a specimen of some other zone gets,
    /// so it draws the rail without holding state for it.
    static let inert = AgentsRailControl(
        scope: .constant(.session),
        isCollapsed: .constant(false),
    )
}
