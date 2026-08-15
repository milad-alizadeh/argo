import Foundation

/// The CLI's built-in commands as one read found them, kept against the version that produced them
/// (#686).
///
/// Keyed by the version string and nothing else: a CLI is upgraded in place, so the path it lives
/// at says nothing about which commands it has.
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — `OwnedStateFile`'s rule, and the state
/// a render harness holds.
@MainActor
struct BuiltinCommandStore {
    /// Beside `mode.json` and `ownership.json`, in the same per-machine folder.
    static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "builtins.json")

    private let file: OwnedStateFile<Remembered>

    init(fileURL: URL?) {
        self.file = OwnedStateFile(fileURL: fileURL)
    }

    /// What was read from the CLI now installed, and `nil` where nothing kept describes it — never
    /// read, or read from a version since replaced.
    func commands(reportedBy version: String?) -> [BuiltinCommand]? {
        guard let version, !version.isEmpty else { return nil }
        let kept = file.load(orEmpty: Remembered(version: "", commands: []))
        return kept.version == version ? kept.commands : nil
    }

    /// Keep one read. A CLI that will not say what version it is keeps nothing: an answer with no
    /// key on it could only ever be handed back to a CLI nobody could show was the same one.
    func remember(_ commands: [BuiltinCommand], reportedBy version: String?) {
        guard let version, !version.isEmpty else { return }
        file.write(Remembered(version: version, commands: commands))
    }

    /// The file's shape, owned here so the format is pinned in one place.
    private struct Remembered: Codable, Sendable {
        let version: String
        let commands: [BuiltinCommand]
    }
}
