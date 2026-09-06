import AtlasFixtures
@testable import AtlasLayout
import CoreGraphics

/// The one tiling every suite about the descent stands on, and the two folders they stand in
/// (#1490).
///
/// Beside the suites rather than inside one, because three of them ask the same two questions of
/// the same measurement, and a second copy of a fixture is a second thing to keep true.
enum AtlasSeatFixture {
    static let ground = CGSize(width: 900, height: 640)

    /// One level down, and three. Both are folders of the committed measurement, so the claims made
    /// about them are about a real repository's nesting rather than about two tidy fixtures.
    static let shallow = "argo/docs"
    static let deep = "argo/apps/macOS/Packages"

    static func map() throws -> AtlasMap {
        try AtlasMapFixture.argo()
    }

    /// The tiling, laid out from the repository's root — which is the only place it is ever laid
    /// out from now, whatever folder the reader is standing in.
    static func plan() throws -> AtlasPlan {
        try AtlasStandpoint(on: map()).plan(by: AtlasChannels("lines"), into: ground)
    }
}
