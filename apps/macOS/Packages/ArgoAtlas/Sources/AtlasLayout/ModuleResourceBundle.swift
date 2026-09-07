import Foundation

/// The bundle SwiftPM hands out as `Bundle.module`, resolved the same way but landing on `nil`
/// instead of trapping when it is not on disk.
///
/// `Bundle.module`'s generated accessor is a `static let` that calls `fatalError` on this exact
/// candidate walk coming up empty (#1633) — a build whose `.bundle` is swept or replaced under a
/// running process finds that out on first touch.
///
/// The walk is written here once and read by every target that ships resources: `AtlasView` and
/// `AtlasFixtures` in this package, and `ArgoEngine` through `EngineBundle` (#1652). It does not
/// vary by bundle name, and each of them already depends on this target — `AtlasLayout` depends on
/// nothing at all, so an edge from above it costs a caller nothing. Written out per package
/// instead, it was the largest clone in the tree and it put the duplication gate over its
/// threshold.
public enum ModuleResourceBundle {
    private final class Anchor {}

    public static func resolve(bundleName: String) -> Bundle? {
        let overrides: [URL]
        #if DEBUG
            if let override = ProcessInfo.processInfo.environment["PACKAGE_RESOURCE_BUNDLE_PATH"]
                ?? ProcessInfo.processInfo.environment["PACKAGE_RESOURCE_BUNDLE_URL"] {
                overrides = [URL(fileURLWithPath: override)]
            } else {
                overrides = []
            }
        #else
            overrides = []
        #endif

        let candidates = overrides + [
            // Linked into an app: SwiftPM's Xcode integration copies the resource bundle into
            // the app bundle's own Resources.
            Bundle.main.resourceURL,
            Bundle(for: Anchor.self).resourceURL,
            // Command-line tools, and `swift test`: `swift build`'s own generated accessor bakes
            // the exact `.build/<triple>/<config>` path in, because that is where it places the
            // resource bundle — beside the test bundle or executable, not inside a Resources
            // folder. Anchor's own bundle is that test bundle or executable, so its directory is
            // the same place.
            Bundle(for: Anchor.self).bundleURL.deletingLastPathComponent(),
            Bundle.main.bundleURL,
        ]

        for candidate in candidates {
            let bundlePath = candidate?.appendingPathComponent(bundleName + ".bundle")
            if let bundle = bundlePath.flatMap(Bundle.init(url:)) {
                return bundle
            }
        }
        return nil
    }
}
