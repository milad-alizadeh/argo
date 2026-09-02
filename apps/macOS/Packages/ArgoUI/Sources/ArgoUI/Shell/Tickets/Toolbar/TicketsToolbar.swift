import SwiftUI

/// What the Tickets room puts in the WINDOW's toolbar row: every control the room has, on one line.
///
/// **One row, not three.** The controls were split across two per-pane bands under #836, one over
/// each column, so a reader met the same row of marks at three different heights — the scope chips
/// and search in the window's row, the list's own marks over the list, compose and the ticket's
/// verbs over the ticket. Nothing about a list-scoped mark says which column it acts on, so the
/// split bought placement nobody could read and cost the room a line of height in both panes.
///
/// Order is the row's argument, read left to right: the list's own controls, then the one thing
/// this window creates, then the open ticket's verbs, then search at the trailing edge where the
/// HIG puts one and where Mail's is.
///
/// Each vessel draws its own glass, so every item hides the shared background a toolbar region
/// would otherwise stack a second capsule under.
package struct TicketsToolbar: ToolbarContent {
    package let reading: TicketsChromeProjection.Reading
    var intents = TicketsToolbarIntents.inert
    /// What the row HOLDS rather than reads — the query, which outlives the pane and is therefore
    /// held above the room (`TicketsRoom.Held`).
    var held = TicketsRoom.Held.unheld

    @ToolbarContentBuilder package var body: some ToolbarContent {
        if reading.draws {
            // `narrows` and not `draws`: the controls that act on the list go with the list they
            // act on, so an empty backlog loses them where New ticket survives.
            if reading.narrows {
                ToolbarItem(placement: .primaryAction) {
                    BacklogControls()
                }
                .sharedBackgroundVisibility(.hidden)
            }
            ToolbarItem(placement: .primaryAction) {
                NewTicketButton(creation: intents.creation)
            }
            .sharedBackgroundVisibility(.hidden)
            // The verbs address the ticket the deck is OPEN on. With none open there is nothing for
            // Start, open-on-host or copy link to name, and the vessel goes rather than standing
            // there addressing nobody.
            if reading.ticket != nil {
                ToolbarItem(placement: .primaryAction) {
                    StartControl(verbs: intents.verbs)
                }
                .sharedBackgroundVisibility(.hidden)
            }
            if reading.narrows {
                // The region packs from its own leading edge, which is where the items above end —
                // without this the field sits against them rather than at the window's trailing
                // edge.
                ToolbarSpacer(.flexible, placement: .primaryAction)
                ToolbarItem(placement: .primaryAction) {
                    BacklogSearchField(query: held.query)
                }
                .sharedBackgroundVisibility(.hidden)
            }
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        reading: TicketsChromeProjection.Reading,
        intents: TicketsToolbarIntents = TicketsToolbarIntents.inert,
        held: TicketsRoom.Held = TicketsRoom.Held.unheld,
    ) {
        self.reading = reading
        self.intents = intents
        self.held = held
    }
}
