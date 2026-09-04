import Foundation

/// The Model and the Effort the user last picked, and the pair a New Session opens on (#1175).
///
/// The same shape `SessionModeStore` gives the rung (#629), and beside its file for the same
/// reason: one value for the whole app, because what to think with says how the user wants to work
/// rather than something about a repository.
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — a test or render harness that named no
/// folder must not read or write the machine's real preference.
@MainActor
public final class SessionRunStore {
    /// Beside `mode.json`, in the same per-machine folder.
    public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "run.json")

    private let file: OwnedStateFile<Remembered>

    init(fileURL: URL?) {
        self.file = OwnedStateFile(fileURL: fileURL)
    }

    /// What a spawn opens on. `Opus 5 · Medium` where nothing has been picked, and each half read
    /// on its own: a file naming a model but an effort off the ladder still opens on that model.
    func lastPicked() -> SessionRun {
        let remembered = file.load(orEmpty: Remembered(model: "", effort: ""))
        return SessionRun(
            model: remembered.model.isEmpty ? SessionRun.unpicked.model : remembered.model,
            effort: SessionEffort(rawValue: remembered.effort) ?? SessionRun.unpicked.effort,
        )
    }

    /// Keep a pick. Called where the pick LANDED, so a value the port refused is not the one the
    /// next Session opens on — and one knob at a time, because that is how the popover sets them:
    /// the half nobody touched is written back as it was rather than reset to the default.
    func remember(_ pick: SessionRunPick) {
        let picked = lastPicked()
        switch pick {
        case let .model(model):
            file.write(Remembered(model: model, effort: picked.effort.rawValue))
        case let .effort(effort):
            file.write(Remembered(model: picked.model, effort: effort.rawValue))
        }
    }

    /// The file's shape, owned here so the format is pinned in one place. Both halves are spelled
    /// in the CLI's own words — the model verbatim as it goes on argv, the effort as its rung's raw
    /// value, which is `claude`'s word for it too (`ClaudeEffort`).
    private struct Remembered: Codable, Sendable {
        let model: String
        let effort: String
    }
}
