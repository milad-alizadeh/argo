import AtlasFixtures
import AtlasLayout
import Testing

/// Finding one node in the committed measurement. Here rather than in `AtlasFixtures` because
/// `#require` is the suite's vocabulary: a failure names the path that found nothing, which is
/// only useful to a test.
extension AtlasMapFixture {
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
