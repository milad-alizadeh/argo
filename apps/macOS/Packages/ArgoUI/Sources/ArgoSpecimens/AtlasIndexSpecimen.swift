import ArgoDesign
import ArgoUI
import AtlasFixtures
import AtlasLayout
import SwiftUI

/// The list beside the map, and the search that narrows it (#1155) — the design's `search` state.
///
/// A specimen rather than a preview for `AtlasReadingSpecimen`'s reason, one gesture along: a
/// question is asked at a keyboard, and no screenshot types. `AtlasRoomHost(typed:)` is the seam
/// that stands it up, and nothing in the app passes one.
///
/// The committed measurement, so the rows are real paths of a real repository at real widths —
/// the two lines of a row are a clipping problem, and a fixture of tidy names never clips.
struct AtlasIndexSpecimen: View {
    /// A question that finds a handful rather than one or a hundred: enough rows to see the rhythm
    /// of the list, few enough that the count above them is checkable by eye.
    var typed = "atlas swift"
    var opened: String?

    var body: some View {
        AtlasRoomHost(reading: .measured(indexFixtureMap), opened: opened, typed: typed)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
    }
}

/// The whole repository, nobody having asked anything — the list's resting state, and the one a
/// reader who does not know the repository meets first.
struct AtlasIndexRestingSpecimen: View {
    var body: some View {
        AtlasIndexSpecimen(typed: "")
    }
}

/// A row selected and the map marked from it: the ticket's claim that the two agree, in the one
/// frame where both are visible at once.
struct AtlasIndexSelectedSpecimen: View {
    var body: some View {
        AtlasIndexSpecimen(typed: "atlas swift", opened: AtlasReadingSpecimen.opened)
    }
}

/// The state the ticket's last criterion is about: a question nothing answers says so, rather than
/// leaving an empty box that cannot be told from a list which has not drawn yet.
struct AtlasIndexEmptySpecimen: View {
    var body: some View {
        AtlasIndexSpecimen(typed: "kubernetes helm")
    }
}

/// The committed measurement, or the floor with no city on it where the bundled fixture will not
/// load — a specimen that trapped would be a harness failure dressed as a product one.
private let indexFixtureMap = (try? AtlasMapFixture.argo())
    ?? AtlasMap(measuredAt: Date(), commit: nil, root: AtlasPlate(path: "empty", children: []))

#Preview("Atlas index — a question with answers") {
    AtlasIndexSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas index — the whole repository") {
    AtlasIndexRestingSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas index — a row selected, the map marked") {
    AtlasIndexSelectedSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas index — a question nothing answers") {
    AtlasIndexEmptySpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}
