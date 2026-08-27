import ArgoEngine
import SwiftUI

/// The Work room's controls, in the window's ONE toolbar row, each placed over the thing it acts
/// on — Mail's rule, transposed (`cockpit-work-room.md`).
///
/// ## Which column each control lands over, and why it is settled this way
///
/// The design is a three-column room, and macOS gives per-column toolbar regions only to a genuine
/// three-column `NavigationSplitView`. Neither of the two obvious routes to that is open here.
/// `.principal` is not a centring but a slot between the regions — `ShellToolbar` records what it
/// did when it was tried, which was to park the Session title against the scope vessel and push
/// Rooms into the overflow menu. And the shell's split view is unconditional (#812: "a room fills
/// the shell's slots rather than replacing them"), so forking it per room would rebuild the whole
/// window on every room switch and drop the deck's per-Session state, both seam drags and the
/// sidebar's width with it.
///
/// **So the row claims the column boundary directly.** Every item here is `.primaryAction`, which
/// is the region the DETAIL pane draws — `.navigation` is the window's leading region and lands
/// over the sidebar, where the scope vessel is. `BacklogToolbarLabel` then takes
/// `ArgoWorkToolbar.listBlockWidth` at that region's leading edge, which is the backlog's own fixed
/// width — so it lands over the list, and everything after it lands over the ticket column, at
/// every window size. The boundary is not estimated: `ArgoBacklogList.width` does not move with the
/// window, which is the property that makes this work where a share or a spacer would not.
struct WorkToolbar: ToolbarContent {
    let reading: WorkToolbarProjection.Reading
    var intents = WorkToolbarIntents.inert
    /// The two things the row HOLDS rather than reads — grouped, because the parameter cap is three
    /// and a binding pair travels together (the `DeckSeams` shape).
    var held: Held

    struct Held {
        var query: Binding<String>
        var mode: Binding<SessionMode>

        /// Nothing remembers either, for a `#Preview` with no room above it.
        static let unheld = Held(query: .constant(""), mode: .constant(.code))
    }

    @ToolbarContentBuilder var body: some ToolbarContent {
        if reading.draws {
            ToolbarItem(placement: .primaryAction) {
                BacklogToolbarLabel(
                    reading: reading,
                    narrowing: intents.narrowing,
                    grouping: intents.grouping,
                )
            }
            // Each vessel draws its own glass, so the shared background the toolbar puts behind a
            // region would stack a second capsule under all of them.
            .sharedBackgroundVisibility(.hidden)
            ToolbarItem(placement: .primaryAction) {
                deckControls
            }
            .sharedBackgroundVisibility(.hidden)
            ToolbarSpacer(.flexible, placement: .primaryAction)
            if reading.narrows {
                ToolbarItem(placement: .primaryAction) {
                    BacklogSearchField(query: held.query)
                }
                .sharedBackgroundVisibility(.hidden)
            }
        }
    }

    /// The ticket column's own: the call-to-action that opens it, then the open ticket's verbs. One
    /// item rather than two, so the toolbar cannot slip a region's own spacing between a pair the
    /// design sets at `comfortable`.
    private var deckControls: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            NewTicketButton(act: intents.creating)
            if reading.ticket != nil {
                StartControl(verbs: intents.verbs, mode: held.mode)
            }
        }
    }
}
