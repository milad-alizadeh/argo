@testable import ArgoEngine

/// What one launch was started with, read off argv the way the CLI reads it — shared by every suite
/// that asserts on a flag rather than on the Hub's own reading of it.
@MainActor
extension SpawnFixture {
    /// The rung a launch stands on.
    func launchedRung(_ index: Int = 0) -> String? {
        launched("--permission-mode", index)
    }

    /// The Model a launch was started on: the word after `--model` (#1175).
    func launchedModel(_ index: Int = 0) -> String? {
        launched("--model", index)
    }

    /// And the Effort beside it, read the same way.
    func launchedEffort(_ index: Int = 0) -> String? {
        launched("--effort", index)
    }

    /// The word AFTER one flag, not merely somewhere on the line. `nil` where there is no such
    /// launch, or where it does not carry the flag at all.
    private func launched(_ flag: String, _ index: Int) -> String? {
        guard host.launches.indices.contains(index) else { return nil }
        let arguments = host.launches[index].arguments
        guard let named = arguments.firstIndex(of: flag),
              arguments.indices.contains(named + 1)
        else { return nil }
        return arguments[named + 1]
    }
}
