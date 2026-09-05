import AtlasLayout
import Foundation

/// The written layer of the same repository, read from this target's bundle (#1159).
///
/// Beside the Map fixture and never inside it, which is the whole shape of the thing: the map is
/// drawn from `argo-map.json` alone, and this is fetched separately by anything that wants a
/// sentence beside the numbers. A suite or a specimen that never asks for it draws exactly the map
/// it drew before.
///
/// The Notes come back AS WRITTEN — every one `unchecked`. Comparing a Note to what its subject
/// holds now means opening a file, which is the engine's work and not this package's (ADR-0028
/// rule 6); a caller holding digests runs `checked(against:)` over the result.
public enum AtlasNotesFixture {
    /// What was written about this repository, at the checkout the Map fixture measured.
    public static func argo() throws -> AtlasNotes {
        let name = "argo-notes"
        guard let url = Bundle.module.url(
            forResource: name,
            withExtension: "json",
            subdirectory: "Fixtures",
        ) else {
            throw AtlasMapFixture.Missing(name: name)
        }
        // The one file this target carries that can be well-formed JSON and still not be what it
        // claims: the Notes reader answers every such case with nothing, so a bundled file that
        // stopped being a written layer would otherwise read as a repository nobody wrote about.
        guard let notes = try AtlasNotes(decoding: Data(contentsOf: url)) else {
            throw AtlasMapFixture.Missing(name: name)
        }
        return notes
    }
}
