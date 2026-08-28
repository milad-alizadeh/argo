import ArgoEngine
import SwiftUI

/// The Work room's chrome alone — the window's one row of controls, over the heading the list
/// keeps — for the two vacancies the shipping shell cannot be driven into, since its Work room is
/// fed from one fixture.
///
/// The chrome and not the room, because what these states differ in IS the chrome: an empty backlog
/// keeps New ticket and loses everything that narrows a list, and an unbound provider keeps nothing
/// at all.
struct WorkChromeSpecimen: View {
    private let reading: WorkReading

    @State private var query = ""
    @State private var mode = SessionMode.code

    init(reading: WorkReading) {
        self.reading = reading
    }

    private var chrome: WorkChromeProjection.Reading {
        WorkChromeProjection.reading(
            of: WorkRoomProjection.room(from: reading),
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
            DeckSeparator()
            Spacer(minLength: ArgoSpacing.flush)
        }
        // Pinned to the TOP: the heading sits at the head of its pane, and a shot that centred it
        // would be a render of the specimen's own stack rather than of the room.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .argoDeckSurface()
        .toolbar {
            WorkToolbar(reading: chrome, held: WorkRoom.Held(query: $query, mode: $mode))
        }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
    }
}
