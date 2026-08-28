import SwiftUI

/// What the Work room puts in the WINDOW's toolbar row: every control the room has, on one line.
///
/// **One row, not three.** The controls were split across two per-pane bands under #836, one over
/// each column, so a reader met the same row of marks at three different heights — the scope chips
/// and search in the window's row, filter and the ordering menu over the list, compose and the
/// ticket's verbs over the ticket. Nothing about a filter mark says which column it acts on, so the
/// split bought placement nobody could read and cost the room a line of height in both panes.
///
/// Order is the row's argument, read left to right: the list's own controls, then the one thing
/// this window creates, then the open ticket's verbs, then search at the trailing edge where the
/// HIG puts one and where Mail's is.
///
/// Each vessel draws its own glass, so every item hides the shared background a toolbar region
/// would otherwise stack a second capsule under.
struct WorkToolbar: ToolbarContent {
    let reading: WorkChromeProjection.Reading
    var intents = WorkToolbarIntents.inert
    /// What the row HOLDS rather than reads — the query and the Mode a Session would start in.
    /// Both outlive the pane, so both are held above the room (`WorkRoom.Held`).
    var held = WorkRoom.Held.unheld

    @ToolbarContentBuilder var body: some ToolbarContent {
        if reading.draws {
            // `narrows` and not `draws`: the three controls that narrow a list go with the list
            // they narrow, so an empty backlog loses them where New ticket survives.
            if reading.narrows {
                ToolbarItem(placement: .primaryAction) {
                    BacklogControls(narrowing: intents.narrowing, grouping: intents.grouping)
                }
                .sharedBackgroundVisibility(.hidden)
            }
            ToolbarItem(placement: .primaryAction) {
                NewTicketButton(act: intents.creating)
            }
            .sharedBackgroundVisibility(.hidden)
            // The verbs address the ticket the deck is OPEN on. With none open there is nothing for
            // Start, open-on-host or copy link to name, and the vessel goes rather than standing
            // there addressing nobody.
            if reading.ticket != nil {
                ToolbarItem(placement: .primaryAction) {
                    StartControl(verbs: intents.verbs, mode: held.mode)
                }
                .sharedBackgroundVisibility(.hidden)
            }
        }
        if reading.narrows {
            // The region packs from its own leading edge, which is where the items above end —
            // without this the field sits against them rather than at the window's trailing edge.
            ToolbarSpacer(.flexible, placement: .primaryAction)
            ToolbarItem(placement: .primaryAction) {
                BacklogSearchField(query: held.query)
            }
            .sharedBackgroundVisibility(.hidden)
        }
    }
}
