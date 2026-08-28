import ArgoEngine
import SwiftUI

/// The detail side of the split view, split off `CockpitView.body` so the type-checker can still
/// see through it: with the evidence toggle's state and the room's toolbar in one expression, the
/// body stopped type-checking in reasonable time.
extension CockpitView {
    /// Takes the room already assembled rather than reading `ticketsRoom` again — see the note
    /// there.
    @ViewBuilder func detail(tickets: TicketsRoom?) -> some View {
        @Bindable var navigation = navigation

        // Each resolved once and handed on: reading either a second time re-runs the
        // selection lookup and every projection behind it.
        let vessel = vessel
        let reading = reading

        InstrumentDeckShell(
            room: navigation.room,
            session: navigation.session,
            feed: reading.feed,
            header: reading.header,
            handOff: handOff,
            showing: reading.showing,
            open: $openEvidence,
            step: $evidenceStep,
            vessel: vessel,
            intents: intents(for: vessel),
            readings: reading.readings,
            scope: $feedScope,
            tickets: tickets,
        )
        // What the chain link at the foot of a handed-off reading does. Injected here because
        // this is the one view that holds the navigation.
        .environment(\.argoOpenSession) { fresh in navigation.session = fresh }
        // What a waiting ask row's options and its `Answer` do (#712). Injected here for the
        // reason above: the rows are hosted per table cell, and this is where the Session the
        // answer addresses is known.
        .environment(\.feedAskAnswering, answer(on: reading.asking.live))
        .overlay(alignment: .topLeading) {
            ConnectionChips(
                connection: presentation.connection,
                projectID: presentation.activeProjectID,
                health: health,
                actions: actions,
            )
            .padding(ArgoSpacing.section)
        }
        // On the DETAIL pane, not on the split view. A split view divides the bar into a
        // region per column, and a flexible spacer only expands inside its own — declared
        // on the split view it landed in a region that spans nothing, which left Rooms
        // parked beside the scope vessel instead of at the trailing edge.
        .toolbar {
            ShellToolbar(
                scope: ScopeVessel(presentation: presentation, actions: actions),
                spawn: spawn(in: navigation),
                evidence: evidenceControl,
            )
            roomToolbar(tickets: tickets)
        }
    }
}
