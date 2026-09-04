import AtlasLayout
import SwiftUI

/// The Atlas room, mounted over a Map handed to it — the shape the specimen harness needs.
///
/// The room itself takes its value off the environment (`argoAtlasRoom`), which a specimen has no
/// way to reach from outside the module. This puts one there, so the state a screenshot is worth is
/// the state the app draws rather than a second view built to look like it.
package struct AtlasRoomHost: View {
    private let map: AtlasMap?

    /// `nil` is the Project nobody has measured, which is the room's other reading.
    package init(map: AtlasMap?) {
        self.map = map
    }

    package var body: some View {
        AtlasRoomView()
            .environment(
                \.argoAtlasRoom,
                AtlasRoom(
                    reading: map.map { AtlasReading.measured($0) } ?? .unmeasured,
                    project: CockpitPresentation.Project(
                        id: "argo",
                        name: "argo",
                        location: "/Users/somebody/Developer/argo",
                        isReachable: true,
                        isRegistered: true,
                    ),
                    rebuild: {},
                ),
            )
    }
}
