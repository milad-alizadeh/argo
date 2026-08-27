import SwiftUI

/// What every room's toolbar carries: scope at the window's leading edge, with the one verb the bar
/// spends in front of it, beside the sidebar toggle. What a room adds beyond this is the room's own
/// — see `WorkToolbar`.
///
/// New Session is NOT a second vessel (#433): the verb carries a small glass of its own.
///
/// Scope is ONE toolbar item, because that is what the toolbar draws one Liquid Glass capsule
/// around — a `ToolbarItemGroup` gives each control in it a capsule of its own.
///
/// **The rooms picker is gone from this bar (#816).** It is the sidebar's strip now, under the
/// titlebar rather than in it: a control belongs over the thing it changes, and two pickers for one
/// choice is worse than either placement alone. `RoomsVessel` went with it, and so did the flexible
/// spacer that only ever existed to push it to the trailing edge — this bar's items all sit in the
/// window's `.navigation` region, which needs no spacer to hold them there.
///
/// The Session's title is NOT a toolbar item (#692). `.principal` is a slot between the regions,
/// not a centring: it parked the title against the scope vessel and pushed Rooms into the bar's
/// overflow menu. The title is drawn by `DeckCanopy`, which is the detail pane itself and already
/// reaches up into this band.
struct ShellToolbar: ToolbarContent {
    /// Assembled by the caller: nothing below the bar reads a presentation.
    let scope: ScopeVessel
    let spawn: CockpitSpawn

    @ToolbarContentBuilder var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            NewSessionButton(offer: spawn.offer) { await spawn.run() }
        }
        .sharedBackgroundVisibility(.hidden)
        // Adjacent items in one region share a single Liquid Glass capsule. The item hides that
        // shared background and draws its own; this spacer keeps it off the folder mark beside it.
        ToolbarSpacer(.fixed, placement: .navigation)
        ToolbarItem(placement: .navigation) {
            scope
        }
    }
}
