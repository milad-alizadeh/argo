import ArgoEngine
import SwiftUI

/// The Work room's chrome alone — the window's row over the two bands the panes carry (#836) — for
/// the two vacancies the shipping shell cannot be driven into, since its Work room is fed from one
/// fixture.
///
/// The chrome and not the room, because what these states differ in IS the chrome: an empty backlog
/// keeps New ticket and loses everything that narrows a list, and an unbound provider keeps nothing
/// at all. The bands are drawn at their panes' widths so the shot shows each control ending where
/// its column does, which is the whole of what #836 changed.
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
                TicketBand(reading: chrome, mode: $mode)
                    .frame(width: ArgoTicketDetail.idealWidth)
            }
            DeckSeparator()
            Spacer(minLength: ArgoSpacing.flush)
        }
        // Pinned to the TOP: the bands sit at the head of their panes, and a shot that centred them
        // would be a render of the specimen's own stack rather than of the room.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .argoDeckSurface()
        .toolbar {
            WorkToolbar(reading: chrome, query: $query)
        }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
    }
}
