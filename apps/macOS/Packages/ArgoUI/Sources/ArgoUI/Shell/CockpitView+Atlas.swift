import SwiftUI

/// The Atlas room, assembled — the mirror of `CockpitView+Tickets`, and one seam narrower: the map
/// is not a Hub fact and nothing pushes it, so what it takes is a container of its own rather than
/// a projection over the presentation (#1140, #1148).
extension CockpitView {
    /// The room the deck draws, over the Project this window is scoped to. Handed the container's
    /// reading and the two gestures that move it, so no view below reaches the store.
    var atlasRoom: AtlasRoom {
        AtlasRoom(
            reading: atlas.reading,
            project: presentation.activeProject,
            behind: atlas.behind,
        ) {
            Task { await atlas.rebuild(presentation.activeProject) }
        }
    }

    /// What re-reads the map: which room the window is in, and which Project it is scoped to. A
    /// window that switched Project must never go on drawing the last one's map (ADR-0015).
    var atlasSubject: String {
        "\(navigation.room.rawValue)/\(presentation.activeProject?.id ?? "")"
    }

    /// Read on arriving at the room, and never anywhere else: opening a Map file is work, and a
    /// window sitting in Sessions has asked for none of it.
    func openAtlas() async {
        guard navigation.room == .atlas else { return }
        await atlas.open(presentation.activeProject)
    }
}
