@testable import ArgoEngine

/// One blocked request, carrying the two things a `PatienceTable` has to know about it and the one
/// thing a gate's policy reads above it.
struct Blocked: Patient {
    let patienceID: String
    let toolName: String
    let patiencePeer: Int?
}

/// A table with everything it published under watch, in the order it published it — the pile as its
/// owner would have written it to a ledger, and the refusals as the owner would have sent them.
@MainActor
final class WatchedTable {
    let table: PatienceTable<String, Blocked>
    var published: [[String]] = []
    var refused: [String] = []

    init(patience: PermissionPatience = .default) {
        self.table = PatienceTable(patience: patience, prefix: "blocked")
        table.changed = { [weak self] _, pile in
            self?.published.append(pile.map(\.patienceID))
        }
        table.expired = { [weak self] _, gone in
            self?.refused.append(gone.patienceID)
        }
    }

    /// What is waiting under the one key these tests use, except where a test names another to show
    /// that a key's pile is its own.
    var waiting: [String] {
        table.pending(for: "claim").map(\.patienceID)
    }

    @discardableResult
    func raise(tool: String = "Bash", peer: Int? = 1) -> Blocked? {
        table.raise(for: "claim") {
            Blocked(patienceID: $0, toolName: tool, patiencePeer: peer)
        }
    }
}
