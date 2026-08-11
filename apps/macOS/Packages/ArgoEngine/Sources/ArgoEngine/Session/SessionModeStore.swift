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
        Self.rung(named: file.load(orEmpty: Remembered(rung: "")).rung) ?? .code
    }

    /// Keep a pick. Called where the pick LANDED, so a rung the port refused is not the one the
    /// next Session opens on.
    func remember(_ mode: SessionMode) {
        file.write(Remembered(rung: Self.name(of: mode)))
    }

    /// The file's shape, owned here so the format is pinned in one place rather than following the
    /// domain enum's case names wherever they go.
    private struct Remembered: Codable, Sendable {
        let rung: String
    }

    /// The file's own vocabulary, and never `ClaudePermissionMode`'s: that one answers `plan` for
    /// two rungs, so a preference written through it would forget which of them was picked.
    private static func name(of mode: SessionMode) -> String {
        switch mode {
        case .readOnly: "readOnly"
        case .plan: "plan"
        case .code: "code"
        case .auto: "auto"
        }
    }

    private static func rung(named name: String) -> SessionMode? {
        switch name {
        case "readOnly": .readOnly
        case "plan": .plan
        case "code": .code
        case "auto": .auto
        default: nil
        }
    }
}
