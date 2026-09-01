import Foundation

/// The rung the user last picked, and the one a New Session opens on (#629).
///
/// One value for the whole app rather than one per Project: a rung says how the user wants to work,
/// not something about a repository, and a per-Project default was decided against in triage.
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — a test or render harness that named no
/// folder must not read or write the machine's real preference.
@MainActor
public final class SessionModeStore {
    /// Beside `ownership.json` and `projects.json`, in the same per-machine folder.
    public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "mode.json")

    private let file: OwnedStateFile<Remembered>

    init(fileURL: URL?) {
        self.file = OwnedStateFile(fileURL: fileURL)
    }

    /// What a spawn that names no rung opens on. `Code` where nothing has been picked, which is the
    /// ladder's baseline and the rung Argo spawned on before this file existed (ADR-0025).
    func lastPicked() -> SessionMode {
        SessionModeName.rung(named: file.load(orEmpty: Remembered(rung: "")).rung) ?? .code
    }

    /// Keep a pick. Called where the pick LANDED, so a rung the port refused is not the one the
    /// next Session opens on.
    func remember(_ mode: SessionMode) {
        file.write(Remembered(rung: SessionModeName.of(mode)))
    }

    /// The file's shape, owned here so the format is pinned in one place. Its rung is spelled by
    /// `SessionModeName`, which is the same vocabulary the ownership ledger writes (#966).
    private struct Remembered: Codable, Sendable {
        let rung: String
    }
}
