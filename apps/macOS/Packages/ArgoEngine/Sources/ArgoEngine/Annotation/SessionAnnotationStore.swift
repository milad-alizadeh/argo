import Foundation

/// The per-machine annotation file, and the only thing that writes it.
///
/// Modelled on `ProjectRegistryStore`, and in the same place for the same reason: what a user
/// archived — and, next, what they named — is owned state, never committed, because it is per
/// machine exactly as registration is. Every mutation reads, transitions and writes in one hop on
/// the actor, so two windows archiving at once cannot lose one another's decision.
public actor SessionAnnotationStore {
    /// `userData` in the Electron shell's spelling, beside `projects.json`.
    public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "sessions.json")

    private let fileURL: URL

    public init(fileURL: URL = SessionAnnotationStore.defaultFileURL) {
        self.fileURL = fileURL
    }

    /// A file that cannot be read annotates nothing: a machine that never archived, a
    /// half-written file, a hand-edit gone wrong. A roster with every Session on it is
    /// recoverable — one gesture puts a row back — and refusing to draw the roster is not.
    public func load() -> SessionAnnotations {
        guard let data = try? Data(contentsOf: fileURL),
              let annotations = try? JSONDecoder().decode(SessionAnnotations.self, from: data)
        else { return .empty }
        return annotations
    }

    /// Archive a Session, or put one back — the only act that ever clears a row off the roster.
    /// Nothing derived from a transcript, a branch or a merge calls this (#502, story 14).
    @discardableResult
    public func setArchived(_ isArchived: Bool, sessionID: String) -> SessionAnnotations {
        persist(load().archiving(isArchived, sessionID: sessionID))
    }

    /// Give a Session a name of the user's own, or — with `nil` — drop it and let the derived
    /// title come back (#515, stories 18 and 20). One verb for both, because resetting is not a
    /// second decision: it is this one, unmade.
    @discardableResult
    public func setName(_ name: String?, sessionID: String) -> SessionAnnotations {
        persist(load().naming(name, sessionID: sessionID))
    }

    /// A file that cannot be written still holds for this launch and is forgotten by the next
    /// one. Refusing the gesture is a worse answer to a full disk than losing the memory of it.
    private func persist(_ annotations: SessionAnnotations) -> SessionAnnotations {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        do {
            let directoryURL = fileURL.deletingLastPathComponent()
            try FileManager.default
                .createDirectory(at: directoryURL, withIntermediateDirectories: true)
            try encoder.encode(annotations).write(to: fileURL, options: .atomic)
        } catch {
            // Nothing to recover: the annotations below are the answer either way.
        }
        return annotations
    }
}
