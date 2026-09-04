import SwiftUI

/// What every room's toolbar carries: scope at the window's leading edge, with the one verb the bar
/// spends in front of it where the room creates Sessions, beside the sidebar toggle. What a room
/// adds beyond this is the room's own — see `TicketsToolbar`.
///
/// New Session is NOT a second vessel (#433): the verb carries a small glass of its own.
///
/// Scope is ONE toolbar item, because that is what the toolbar draws one Liquid Glass capsule
/// around — a `ToolbarItemGroup` gives each control in it a capsule of its own.
///
/// Every item here is `.navigation`, which is the WINDOW's leading region — over the sidebar in a
/// split view, not over the detail pane. A room's own row takes `.primaryAction`
/// (`TicketsToolbar`).
///
/// The rooms picker is the sidebar's strip (`RoomStrip`, #816).
///
/// The Session's title is NOT a toolbar item (#692). `.principal` is a slot between the regions,
/// not a centring: it parked the title against the scope vessel and pushed Rooms into the bar's
/// overflow menu. The title is drawn by `DeckCanopy`, which is the detail pane itself and already
/// reaches up into this band.
package struct ShellToolbar: ToolbarContent {
    /// Assembled by the caller: nothing below the bar reads a presentation.
    let scope: ScopeVessel
    /// New Session, in the rooms that create one. `nil` in the Tickets room, whose one create
    /// action is a ticket and wears the compose mark itself (#836) — Mail's window spends exactly
    /// one compose button, and two of them a finger apart is two invitations to make different
    /// things. `⌘N` and the menu bar still reach it from there.
    let spawn: CockpitSpawn?
    /// The evidence panel's toggle, in the room that has a panel and `nil` in the others (#875).
    ///
    /// It rides in THIS content rather than in one of its own, and that is not tidiness: a
    /// `ToolbarSpacer` declared in a sibling `ToolbarContent` — after this one in the same
    /// `.toolbar` — segfaults the app before it puts up a window. Declared here it behaves, and
    /// the spacer is what carries the toggle to the trailing edge.
    var evidence: EvidenceToggle?

    @ToolbarContentBuilder package var body: some ToolbarContent {
        if let spawn {
            ToolbarItem(placement: .navigation) {
                NewSessionButton(offer: spawn.offer) { await spawn.run() }
            }
            .sharedBackgroundVisibility(.hidden)
            // Adjacent items in one region share a single Liquid Glass capsule. The item hides that
            // shared background and draws its own; this spacer keeps it off the folder mark beside
            // it.
            ToolbarSpacer(.fixed, placement: .navigation)
        }
        ToolbarItem(placement: .navigation) {
            scope
        }
        if let evidence {
            // The region packs from its own leading edge, so without this the toggle sits against
            // the scope vessel rather than at the window's trailing edge, which is where a
            // right-hand column's control belongs.
            ToolbarSpacer(.flexible, placement: .primaryAction)
            ToolbarItem(placement: .primaryAction) {
                evidence
            }
            .sharedBackgroundVisibility(.hidden)
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(scope: ScopeVessel, spawn: CockpitSpawn?, evidence: EvidenceToggle? = nil) {
        self.scope = scope
        self.spawn = spawn
        self.evidence = evidence
    }
}
