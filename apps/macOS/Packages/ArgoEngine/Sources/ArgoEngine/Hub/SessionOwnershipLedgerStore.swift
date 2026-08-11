import Foundation

/// The ledger's file, and the only thing that writes it. In Argo's own per-machine data, beside the
/// handoff chain and the annotations — never in the Project.
///
/// `fileURL` is optional, and `nil` means REMEMBER NOTHING — a test or render harness that named no
/// folder must not read or write the machine's real ledger.
@MainActor
public final class SessionOwnershipLedgerStore {
    /// Beside `sessions.json` and `projects.json`, in the same per-machine folder.
    public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "ownership.json")

    private let file: OwnedStateFile<SessionOwnershipLedger>

    init(fileURL: URL?) {
        self.file = OwnedStateFile(fileURL: fileURL)
    }

    /// A ledger that cannot be read is an empty one. It grades every Session `external`, which is
    /// the reading Argo had before this file existed.
    func load() -> SessionOwnershipLedger {
        file.load(orEmpty: SessionOwnershipLedger())
    }

    /// Fold a change into whatever is on disk NOW, and answer what the caller should hold. The
    /// caller's copy was loaded at launch, and another window may have spawned since.
    ///
    /// `held` is that copy, and it is the base only where there is no file: a store that remembers
    /// nothing across launches must still remember within one, or the second Session it is told
    /// about erases the first.
    @discardableResult
    func update(
        folding held: SessionOwnershipLedger,
        _ change: (inout SessionOwnershipLedger) -> Bool,
    )
        -> SessionOwnershipLedger {
        var ledger = file.fileURL == nil ? held : load()
        guard change(&ledger) else { return ledger }
        file.write(ledger)
        return ledger
    }
}
