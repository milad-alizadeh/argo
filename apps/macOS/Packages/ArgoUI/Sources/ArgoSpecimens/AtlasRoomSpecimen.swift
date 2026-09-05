import ArgoDesign
import ArgoUI
import AtlasFixtures
import AtlasLayout
import SwiftUI

/// The committed measurement `AtlasMapSpecimen` and the Atlas suite also read, or the floor with
/// no city on it where the bundled fixture will not load — a specimen that trapped would be a
/// harness failure dressed as a product one.
private let roomFixtureMap = (try? AtlasMapFixture.argo())
    ?? AtlasMap(measuredAt: Date(), commit: nil, root: AtlasPlate(path: "empty", children: []))

/// The Atlas room over a generated atlas: the treemap of #1147 beside the rail that says what was
/// measured, what each channel measures it by, and the one lever that measures it again (#1148,
/// #1161).
///
/// It draws the committed measurement, which is the same fixture `AtlasMapSpecimen` and the
/// Atlas suite read. The picture on its own is that specimen; this one is the ROOM, so what it is
/// worth a look for is the sidebar's sections, the camera floating over the stage, and how the two
/// columns sit around the tiling.
struct AtlasRoomSpecimen: View {
    var body: some View {
        AtlasRoomHost(reading: .measured(roomFixtureMap))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

/// The room's other reading: a Project with no atlas, which is an instruction rather than an empty
/// screen. A fixture that could not be read lands here too, because a specimen that trapped would
/// be a harness failure dressed as a product one.
struct AtlasRoomVacancySpecimen: View {
    var body: some View {
        AtlasRoomHost(reading: .unmeasured)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

/// The walk is running (#1162, the loading state pixel-review judges against #650's render).
struct AtlasRoomLoadingSpecimen: View {
    var body: some View {
        AtlasRoomHost(reading: .measuring)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

/// The Map file is there and would not read (#1162, the error state pixel-review judges against
/// #650's render).
struct AtlasRoomErrorSpecimen: View {
    var body: some View {
        AtlasRoomHost(reading: .unreadable)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

/// A Map that draws, but names a commit the repository has since moved past (#1162). No render is
/// approved for this one — the design draws only the three states with no map to draw — so this
/// specimen is what a look at the staleness clause is worth. It reads in the SIDEBAR's Repository
/// data section now, not over the map: #1161 took the reading strip off the stage, and the clause
/// went with the rest of the provenance.
struct AtlasRoomStaleSpecimen: View {
    var body: some View {
        AtlasRoomHost(reading: .measured(roomFixtureMap), behind: 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

#Preview("Atlas room, a generated atlas") {
    AtlasRoomSpecimen()
        .frame(width: 1080, height: 720)
        .argoAppearance()
}
