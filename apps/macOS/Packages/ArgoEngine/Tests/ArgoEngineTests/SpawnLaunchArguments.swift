@testable import ArgoEngine

/// What one launch was started with, read off argv the way the CLI reads it — shared by every suite
/// that asserts on a flag rather than on the Hub's own reading of it.
@MainActor
extension SpawnFixture {
    /// The rung a launch stands on: the word AFTER `--permission-mode`, not merely somewhere on the
    /// line. `nil` where there is no such launch, or where it carries no rung at all.
    func launchedRung(_ index: Int = 0) -> String? {
        guard host.launches.indices.contains(index) else { return nil }
        let arguments = host.launches[index].arguments
        guard let flag = arguments.firstIndex(of: "--permission-mode"),
              arguments.indices.contains(flag + 1)
        else { return nil }
        return arguments[flag + 1]
    }
}
