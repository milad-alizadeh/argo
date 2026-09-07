import Foundation

/// The bundle SwiftPM hands out as `Bundle.module`, resolved the same way but landing on `nil`
/// instead of trapping when it is not on disk.
///
/// `Bundle.module`'s generated accessor is a `static let` that calls `fatalError` on this exact
/// candidate walk coming up empty (#1633) — a build whose `.bundle` is swept or replaced under a
/// running process finds that out on first touch, which for `AtlasVolumeRenderer` is the first
/// frame it draws. Mirroring the walk here, ending in `nil`, is what lets it fall back to the
/// no-Metal-Toolchain path instead of dying mid-render.
enum ModuleResourceBundle {
    private final class Anchor {}

    /// Cached like `Bundle.module` itself: the filesystem does not move mid-process for a bundle
    /// that resolved once, and a bundle that vanished stays vanished for this process's purposes.
    static let resolved: Bundle? = resolve(bundleName: "ArgoAtlas_AtlasView")

    static func resolve(bundleName: String) -> Bundle? {
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
