import ArgoEngine
import SwiftUI

/// The detail side of the split view, split off `CockpitView.body` so the type-checker can still
/// see through it: with the evidence toggle's state and the room's toolbar in one expression, the
/// body stopped type-checking in reasonable time.
extension CockpitView {
    /// Takes the room and the reading already assembled rather than reading `ticketsRoom` or
    /// `reading` again — see the notes there.
    @ViewBuilder func detail(tickets: TicketsRoom?, reading: SessionsRoomReading) -> some View {
        @Bindable var navigation = navigation

        // Resolved once and handed on: reading it a second time re-runs the selection lookup and
        // every projection behind it.
        let vessel = vessel

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
            readings: subagents.stamped(reading.stamp),
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
        // Injected from ABOVE the deck, which is the whole point of it: the room switch below
        // destroys the table that measured them (#858).
        .environment(\.argoFeedGeometries, feedGeometries)
        // Why the deck has nothing to read, where an empty feed alone cannot say. The header is
        // what answers "did a Session resolve" — it is `nil` exactly when the selection named
        // none — so this costs no second lookup into a roster that moves under an id (#957).
        .environment(
            \.argoFeedVacancy,
            .reading(
                hasSelection: reading.header != nil,
                hasSessions: !presentation.sessions.isEmpty,
            ),
        )
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
                evidence: evidenceControl(in: reading),
            )
            roomToolbar(tickets: tickets)
        }
    }
}
