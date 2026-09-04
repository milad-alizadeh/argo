import ArgoDesign
import ArgoUI
import AtlasFixtures
import SwiftUI

/// The Atlas room over a generated atlas: the treemap of #1147 with the strip that says what was
/// measured, and the one lever that measures it again (#1148).
///
/// It draws the committed measurement, which is the same fixture `AtlasMapSpecimen` and the
/// Atlas suite read. The picture on its own is that specimen; this one is the ROOM, so what it is
/// worth a look for is the strip, the key under the map, and how the two sit around the tiling.
struct AtlasRoomSpecimen: View {
    var body: some View {
        AtlasRoomHost(map: try? AtlasMapFixture.argo())
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

/// The room's other reading: a Project with no atlas, which is an instruction rather than an empty
/// screen. A fixture that could not be read lands here too, because a specimen that trapped would
/// be a harness failure dressed as a product one.
struct AtlasRoomVacancySpecimen: View {
    var body: some View {
        AtlasRoomHost(map: nil)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

#Preview("Atlas room, a generated atlas") {
    AtlasRoomSpecimen()
        .frame(width: 1080, height: 720)
        .argoAppearance()
}
