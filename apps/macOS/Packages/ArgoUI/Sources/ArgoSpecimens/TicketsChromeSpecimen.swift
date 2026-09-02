import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The Tickets room's chrome alone — the window's one row of controls, over the heading the list
/// keeps — for the two vacancies the shipping shell cannot be driven into, since its Tickets room
/// is fed from one fixture.
///
/// The chrome and not the room, because what these states differ in IS the chrome: an empty backlog
/// keeps New ticket and loses everything that narrows a list, and an unbound provider keeps nothing
/// at all.
struct TicketsChromeSpecimen: View {
    private let reading: TicketsReading

    @State private var query: String

    /// Seeded, because the harness cannot type — and the row's own answer to a query that matched
    /// nothing is the state worth shooting: the field has to still be there to clear it (#873).
    init(reading: TicketsReading, matching query: String = "") {
        self.reading = reading
        _query = State(initialValue: query)
    }

    private var chrome: TicketsChromeProjection.Reading {
        TicketsChromeProjection.reading(
            of: TicketsRoomProjection.room(from: reading, matching: query),
            in: .allOpen,
            showing: reading.showing,
        )
    }

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            HStack(spacing: ArgoSpacing.flush) {
                BacklogHeader(reading: chrome)
                    .frame(width: ArgoBacklogList.width)
                DeckSeparator()
                Spacer(minLength: ArgoSpacing.flush)
            }
            // BOUNDED, or the separator inside stretches the row to the window and the heading
            // centres in it — a render of this stack rather than of the room.
            .fixedSize(horizontal: false, vertical: true)
            DeckSeparator()
            Spacer(minLength: ArgoSpacing.flush)
        }
        // Pinned to the TOP: the heading sits at the head of its pane, and a shot that centred it
        // would be a render of the specimen's own stack rather than of the room.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .argoDeckSurface()
        .toolbar {
            TicketsToolbar(reading: chrome, held: TicketsRoom.Held(query: $query))
        }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
    }
}

/// What New ticket opens (#872), on the ground the app puts it on. A sheet is a surface OVER the
/// window, so it is rendered centred rather than in a pane of its own.
struct NewTicketComposerSpecimen: View {
    @State private var composition = TicketComposition()

    var body: some View {
        SpecimenScene.centred {
            NewTicketComposer(composition: $composition)
        }
    }
}
