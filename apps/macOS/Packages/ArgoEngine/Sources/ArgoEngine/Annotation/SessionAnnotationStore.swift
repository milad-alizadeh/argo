import Foundation

/// The per-machine annotation file, and the only thing that writes it. What a user archived or
/// named is owned state, never committed. Every mutation reads, transitions and writes in one hop
/// on the actor, so two windows archiving at once cannot lose one another's decision.
public actor SessionAnnotationStore {
    /// `userData` in the Electron shell's spelling, beside `projects.json`.
    public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "sessions.json")

    private let fileURL: URL

    public init(fileURL: URL = SessionAnnotationStore.defaultFileURL) {
        self.fileURL = fileURL
    }

    /// A file that cannot be read annotates nothing, so the roster draws every Session — a state
    /// one gesture recovers from, where refusing to draw the roster is not.
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
    /// title come back (#502, stories 18 and 20).
    @discardableResult
    public func setName(_ name: String?, sessionID: String) -> SessionAnnotations {
        persist(load().naming(name, sessionID: sessionID))
    }

    /// Hold what the code host said about this Session's ticket (#745). Argo's own write and never
    /// a gesture — the rename is `setName`.
    @discardableResult
    public func setTicket(_ ticket: TicketTitleReading?, sessionID: String) -> SessionAnnotations {
        persist(load().reading(ticket, sessionID: sessionID))
    }

    /// Attach a Session to a Ticket by hand, or — with `nil` — drop the attachment (#1092). A
    /// gesture, unlike `setTicket` above: this is the one write that puts a Session on a Ticket
    /// nothing about its branch or its folder names.
    @discardableResult
    public func setPinnedTicket(_ number: Int?, sessionID: String) -> SessionAnnotations {
        persist(load().pinning(number, sessionID: sessionID))
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
