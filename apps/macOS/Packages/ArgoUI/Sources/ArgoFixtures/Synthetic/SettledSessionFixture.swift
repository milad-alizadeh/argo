import Foundation

/// The largest Session the cockpit is judged against, in its two forms: the synthetic that is
/// checked in and the real transcript that never is (ADR-0030).
///
/// Both are addressed from the SOURCE tree rather than from a bundle, because neither belongs in
/// anything that ships: `ArgoSpecimens` links these fixtures and the app links `ArgoSpecimens`, so
/// a resource here would put a synthetic transcript inside the product.
package enum SettledSessionFixture {
    package static let synthetic = fixtures.appending(path: "\(name).jsonl")

    /// What both files were generated to share, or `nil` where the fixture has not been written —
    /// which the suite reads as a failure rather than as an absence to work around.
    package static var shape: SyntheticShape? {
        guard let data = try? Data(contentsOf: fixtures.appending(path: "\(name).shape.json"))
        else { return nil }
        return try? JSONDecoder().decode(SyntheticShape.self, from: data)
    }

    /// Where a real transcript goes on the machine that has one. The whole directory is gitignored:
    /// the repository is public and a transcript is somebody's own words.
    package static let real = appDirectory.appending(path: "Fixtures")
        .appending(path: "\(name).jsonl")

    package static let name = "settled-session"

    /// `apps/macOS`, six directories above this file. A source path because a suite has no working
    /// directory it can count on; a wrong one fails the fixture suite outright, since the synthetic
    /// it addresses is required rather than optional.
    private static let appDirectory = (0 ..< 6)
        .reduce(URL(filePath: #filePath)) { at, _ in at.deletingLastPathComponent() }

    private static let fixtures = URL(filePath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appending(path: "Fixtures")
}
