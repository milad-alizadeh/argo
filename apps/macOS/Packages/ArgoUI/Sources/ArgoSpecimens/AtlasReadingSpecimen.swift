import ArgoDesign
import ArgoUI
import AtlasFixtures
import AtlasLayout
import AtlasView
import SwiftUI

/// A file open beside the map, which is the whole of #1154 — the design's `inspect` state, and
/// what `pixel-review` judges against `docs/designs/renders/650-atlas-inspect.png`.
///
/// It is a specimen rather than a preview because the state cannot be reached without a POINTER: a
/// reading opens on a click, and no screenshot drives one. `AtlasRoomView(opened:)` is the one
/// seam that stands it up, and nothing in the app passes it.
///
/// The committed measurement, for the reason every other Atlas specimen reads it: the file opened
/// below is a real file of this repository with real numbers, and a panel judged on tidy ones is a
/// panel judged on the one repository that does not exist.
struct AtlasReadingSpecimen: View {
    /// A file measured for all five: 121 lines, 13 commits, one author, and no age at all. The
    /// busiest file in the fixture, so the gauge's needle stands near the top of the ramp rather
    /// than in the middle where a needle that is off by a band would not show.
    static let opened = "argo/apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/" +
        "Evidence/EvidencePanel.swift"

    var opened = Self.opened

    var body: some View {
        AtlasRoomHost(
            reading: .measured(readingFixtureMap),
            opening: AtlasRoomOpening(opened: opened),
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoDeckSurface()
    }
}

/// The state the ticket's last criterion is about: a file the repository measured nothing for but
/// its size. Twenty of the fixture's eighty-nine are PNGs with no `lines`, no `commits`, no
/// `authors` and no age, and the failure worth a render rather than an assertion is a panel
/// quietly reading 0 on every one of them.
struct AtlasReadingUnmeasuredSpecimen: View {
    var body: some View {
        AtlasReadingSpecimen(opened: "argo/docs/designs/composer-picker/at-filter.png")
    }
}

/// A file somebody wrote about, with what they wrote beside the numbers (#1159) — the design's own
/// `.said` block, and the state the ticket's first criterion is about.
///
/// Its own specimen rather than a change to the one above, because the pair is the claim: the same
/// file, the same measurement and the same tiling, drawn once with a written layer beside the map
/// and once without. A repository with none draws `atlasReading`, and nothing about it moves.
struct AtlasReadingNoteSpecimen: View {
    /// What the noted file holds NOW, which is the engine's job in the app — the store digests the
    /// file on disk and the layer decides what that means. A specimen has no repository to digest,
    /// so it hands in the answer: the digest the note recorded reads current, and anything else
    /// reads stale.
    var digest: String? = writtenFixture.note(ofFile: AtlasReadingSpecimen.opened)?.subject

    /// What the noted file holds now, keyed by its path — the shape the engine's store hands the
    /// layer, and empty where a specimen wants a Note nothing checked.
    private var held: [String: String] {
        digest.map { [AtlasReadingSpecimen.opened: $0] } ?? [:]
    }

    var body: some View {
        AtlasRoomHost(reading: .measured(readingFixtureMap), opened: AtlasReadingSpecimen.opened)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
            // Set OUTSIDE the host, which is the seam the written layer earns by being separate:
            // the room reads it off the environment, so nothing in the host's own value has to
            // grow a field for a fact that may never arrive.
            .environment(\.argoAtlasNotes, writtenFixture.checked(against: held))
    }
}

/// The same note read against a file that has changed since it was written: it STAYS, and it says
/// so. The failure this guards is a stale sentence that reads exactly like a current one, which no
/// assertion about the value can see.
struct AtlasReadingStaleNoteSpecimen: View {
    var body: some View {
        AtlasReadingNoteSpecimen(digest: "0000000000000000")
    }
}

/// The committed written layer, or nothing written where the bundled file will not load — which is
/// a repository nobody wrote about, and draws the map either way.
private let writtenFixture = (try? AtlasNotesFixture.argo()) ?? .none

/// The committed measurement, or the floor with no city on it where the bundled fixture will not
/// load — a specimen that trapped would be a harness failure dressed as a product one.
private let readingFixtureMap = (try? AtlasMapFixture.argo())
    ?? AtlasMap(measuredAt: Date(), commit: nil, root: AtlasPlate(path: "empty", children: []))

#Preview("Atlas reading — a file open beside the map") {
    AtlasReadingSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas reading — a file the repository measured nothing for") {
    AtlasReadingUnmeasuredSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas reading — a file somebody wrote about") {
    AtlasReadingNoteSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}

#Preview("Atlas reading — a note that has gone stale against its file") {
    AtlasReadingStaleNoteSpecimen()
        .frame(width: 1280, height: 800)
        .argoAppearance()
}
