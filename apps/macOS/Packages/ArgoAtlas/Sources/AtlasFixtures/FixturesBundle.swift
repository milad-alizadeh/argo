import AtlasLayout
import Foundation

/// This target's own resource bundle, resolved once and shared by both fixtures — the Map and the
/// Notes are read from the same `Fixtures` directory in the same bundle (#1633).
enum FixturesBundle {
    static let resolved: Bundle? = ModuleResourceBundle
        .resolve(bundleName: "ArgoAtlas_AtlasFixtures")
}
