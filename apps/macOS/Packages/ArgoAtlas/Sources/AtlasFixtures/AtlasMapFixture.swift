import AtlasLayout
import Foundation

/// The committed measurement, read from this target's bundle (#1145).
///
/// A target of its own rather than a resource of the suite that first needed it, because the
/// specimen harness draws the same map the tests assert on and a second copy of 47 KB of measured
/// JSON is two fixtures that can disagree. `Fixtures/README.md` states what was measured and which
/// awkward cases it was kept for.
public enum AtlasMapFixture {
    /// The failure a caller gets when the bundle does not carry the file — a value rather than a
    /// trap, because this target is linked into the shipped binary by the specimen harness.
    public struct Missing: Error {
        public let name: String
    }

    /// This repository, as measured at commit 4478553.
    public static func argo() throws -> AtlasMap {
        let name = "argo-map"
        guard let url = Bundle.module.url(
            forResource: name,
            withExtension: "json",
            subdirectory: "Fixtures",
        ) else {
            throw Missing(name: name)
        }
        return try AtlasMap(decoding: Data(contentsOf: url))
    }
}
