import ArgoEngine
import SwiftUI

/// The Work room's controls, in the window's ONE toolbar row, each placed over the thing it acts
/// on — Mail's rule, transposed (`cockpit-work-room.md`).
///
/// ## How each control lands over its own column
///
/// Every item here is `.primaryAction`, which is the region the DETAIL pane draws — `.navigation`
/// is the window's leading region and lands over the sidebar, where the scope vessel is.
/// `BacklogToolbarLabel` takes `ArgoWorkToolbar.listBlockWidth` at that region's leading edge,
/// which is `ArgoBacklogList.width` and does not move with the window — so it lands over the list,
/// and everything after it lands over the ticket column, at every window size.
///
/// Per-column toolbar REGIONS would need a genuine three-column `NavigationSplitView`, which the
/// shell does not have: its split view is unconditional (#812). Why that stands and `.principal`
/// does not is in `docs/designs/cockpit-work-room.md`, "The column question, settled".
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
