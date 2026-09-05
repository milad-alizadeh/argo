import AtlasLayout
import SwiftUI

/// The Atlas room, mounted over a Map handed to it — the shape the specimen harness needs.
///
/// The room itself takes its value off the environment (`argoAtlasRoom`), which a specimen has no
/// way to reach from outside the module. This puts one there, so the state a screenshot is worth is
/// the state the app draws rather than a second view built to look like it.
package struct AtlasRoomHost: View {
    private let reading: AtlasReading
    private let behind: Int?

    /// `.unmeasured` is the Project nobody has measured, which is the room's other reading. Only a
    /// `.measured` reading draws `behind` at all (#1162); a specimen handing it in with another
    /// reading asserts nothing.
    package init(reading: AtlasReading, behind: Int? = nil) {
        self.reading = reading
        self.behind = behind
    }

    package var body: some View {
        AtlasRoomView()
            .environment(
                \.argoAtlasRoom,
                AtlasRoom(
                    reading: reading,
                    project: CockpitPresentation.Project(
                        id: "argo",
                        name: "argo",
                        location: "/Users/somebody/Developer/argo",
                        isReachable: true,
                        isRegistered: true,
                    ),
                    behind: behind,
                    rebuild: {},
                ),
            )
    }
}
