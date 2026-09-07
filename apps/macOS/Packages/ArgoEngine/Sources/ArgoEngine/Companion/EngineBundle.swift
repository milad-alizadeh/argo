import AtlasLayout
import Foundation

/// This module's own resource bundle: the `Companion/Plugin` directory every spawn writes out.
///
/// Resolved through `AtlasLayout.ModuleResourceBundle` rather than through `Bundle.module`, whose
/// generated accessor is a `static let` that calls `fatalError` when the bundle is not on disk
/// (#1633) — a build swept or replaced under a running process finds that out on first touch, and
/// it takes the whole app down rather than the one spawn that needed the resource. The shared walk
/// ends in `nil` instead, which is what lets `CompanionPlugin` answer "missing" rather than die on
/// the question.
///
/// The walk lives in `AtlasLayout` because it does not vary by bundle name and this package
/// already depends on that target. Written out here as well, it was the largest clone in the tree
/// and it put the duplication gate over its threshold (#1652). `AtlasFixtures` resolves its own
/// bundle the same way.
///
/// Cached like `Bundle.module` itself: the filesystem does not move mid-process for a bundle that
/// resolved once, and a bundle that vanished stays vanished for this process's purposes.
enum EngineBundle {
    static let resolved: Bundle? = ModuleResourceBundle.resolve(bundleName: "ArgoEngine_ArgoEngine")
}
