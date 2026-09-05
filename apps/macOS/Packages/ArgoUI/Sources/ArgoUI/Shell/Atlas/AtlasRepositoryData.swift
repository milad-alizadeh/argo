import ArgoDesign
import AtlasLayout
import AtlasView
import SwiftUI

/// Where the map came from, and the one lever that measures it again — the design's
/// `Repository data` section of the sidebar (`#regen-slot`).
///
/// The provenance line is what makes a measurement checkable: how many files were found and which
/// commit was measured. A map with no numbers beside it is a picture nobody can falsify (#1140).
/// It is said in the sidebar rather than over the map because the design puts nothing over the
/// stage but the picture and the camera.
struct AtlasRepositoryData: View {
    @Environment(\.argo) private var argo

    /// The map as it is DRAWN — filtered, where test files are hidden — so the count here and the
    /// tiles on screen are the same set (#1161).
    let map: AtlasMap
    /// How far the repository has moved since this Map was measured (#1162). `nil` where nothing
    /// can be said about its age.
    let behind: Int?
    let rebuild: () -> Void

    var body: some View {
        AtlasSidebarSection("Repository data") {
            AtlasRebuildButton(title: "Rebuild map", rebuild: rebuild)
                .help("Re-measure the repository. No model calls.")
            Text(provenance)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// How much was found, what it was measured against, and how far the repository has moved
    /// since. A repository with no commits yet says so rather than naming a commit it does not
    /// have.
    private var provenance: String {
        let commit = map.commit.map { String($0.prefix(7)) } ?? "no commits yet"
        return "\(map.plots.count) files · \(commit)\(staleness)"
    }

    /// " · N commits behind", or nothing where there is nothing to say about the Map's age or the
    /// age is zero. A map this stale is still drawn — it is a reading of a real commit, not an
    /// error — but the reader is told it is no longer the one the working tree is on (#1162).
    ///
    /// Said HERE rather than over the map: #1161 took the reading strip off the stage, and this is
    /// where the rest of that sentence's facts went with it.
    private var staleness: String {
        guard let behind, behind > 0 else { return "" }
        return " · \(behind) commit\(behind == 1 ? "" : "s") behind"
    }
}
