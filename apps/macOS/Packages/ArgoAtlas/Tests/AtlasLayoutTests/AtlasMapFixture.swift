@testable import AtlasLayout
import Foundation
import Testing

/// The committed measurement, read from the test bundle.
///
/// Real numbers off a real repository, trimmed — `Fixtures/README.md` states what was measured and
/// which awkward cases it was kept for. A test that wants a tidy number writes its own JSON rather
/// than editing this, because editing it retires the only evidence the reader survives real data.
enum AtlasMapFixture {
    static func data(_ name: String) throws -> Data {
        let url = try #require(
            Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"),
        )
        return try Data(contentsOf: url)
    }

    /// This repository, as measured at commit 4478553.
    static func argo() throws -> AtlasMap {
        try AtlasMap(decoding: data("argo-map"))
    }

    /// The one Plot at a path, or a failure naming the path that found nothing.
    static func plot(_ path: String, in map: AtlasMap) throws -> AtlasPlot {
        try #require(map.plots.first { $0.path == path })
    }

    /// The one Plate at a path, or a failure naming the path that found nothing.
    static func plate(_ path: String, in map: AtlasMap) throws -> AtlasPlate {
        func search(_ plate: AtlasPlate) -> AtlasPlate? {
            if plate.path == path {
                return plate
            }
            for child in plate.children {
                guard case let .plate(nested) = child else { continue }
                if let found = search(nested) {
                    return found
                }
            }
            return nil
        }
        return try #require(search(map.root))
    }
}
