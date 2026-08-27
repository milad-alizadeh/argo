import ArgoEngine
import SwiftUI

/// The Work room's toolbar row alone, on an empty plane — the harness for the two vacancies the
/// shipping shell cannot be driven into, since its Work room is fed from one fixture.
///
/// The row and not the room, because what these states differ in IS the row: an empty backlog keeps
/// New ticket and loses everything that narrows a list, and an unbound provider keeps nothing at
/// all. `WorkRoomSpecimen` is where the row is read against the panes it sits over.
struct WorkToolbarSpecimen: View {
    private let reading: WorkReading

    @State private var query = ""
    @State private var mode = SessionMode.code

    init(reading: WorkReading) {
        self.reading = reading
    }

    var body: some View {
        Color.clear
            .toolbar {
                WorkToolbar(
                    reading: WorkToolbarProjection.reading(
                        of: WorkRoomProjection.room(from: reading),
                        in: .allOpen,
                        showing: reading.showing,
                    ),
                    held: WorkToolbar.Held(query: $query, mode: $mode),
                )
            }
            .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
    }
}
