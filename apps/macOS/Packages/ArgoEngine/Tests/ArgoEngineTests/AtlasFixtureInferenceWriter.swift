@testable import ArgoEngine
import AtlasLayout
import Foundation
import Testing

/// A one-off: runs the shipped clusterer over a Map file and writes its inference back into it, so
/// the specimen and the previews draw a domain map inferred from real filenames and a real history
/// rather than from something typed by hand.
///
/// Run by hand and never on the suite — `ARGO_ATLAS_FIXTURE=<path to argo-map.json> swift test
/// --filter AtlasFixtureInferenceWriter`. Gated on the variable that says WHICH file to write
/// rather than on a `.disabled` reason, so there is no way to run it that does not also say what
/// it is about to overwrite.
///
/// It is kept rather than deleted for the reason the fixture's own README is kept: how the
/// committed data was produced is the only thing that lets a later reader reproduce or refresh it,
/// and this is the one place that answer is executable.
@Suite(
    "Atlas — writing a Map file's own inference",
    .enabled(if: ProcessInfo.processInfo.environment["ARGO_ATLAS_FIXTURE"] != nil),
)
struct AtlasFixtureInferenceWriter {
    @Test func `the committed measurement is given its own inference`() throws {
        let path = try #require(ProcessInfo.processInfo.environment["ARGO_ATLAS_FIXTURE"])
        let file = URL(fileURLWithPath: path)
        let map = try AtlasMap(decoding: Data(contentsOf: file))
        let inferred = AtlasDomains.inferred(
            over: map.plots.map(\.path),
            coupledBy: map.couplings,
            called: map.root.name,
        )
        let written = AtlasMap(
            measuredAt: map.measuredAt,
            commit: map.commit,
            root: map.root,
            relations: AtlasRelations(couplings: map.couplings, inference: inferred),
        )
        try written.encoded().write(to: file)
        print("domains: \(inferred.domains.count), unassigned: \(written.unassigned.count)")
    }
}
