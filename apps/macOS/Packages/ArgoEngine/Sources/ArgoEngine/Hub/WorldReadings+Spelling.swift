/// How the file system spells the folders these readings answer about, and what settles that.
///
/// The table exists because `realpath(3)` ran on the main actor once per Session per read of the
/// roster, and the roster is read several times per scene pass (#959). It is a SWEEP's answer held
/// for the readers, not a memo: see `resolved`.
@MainActor
extension WorldReadings {
    /// How much of the table one call settles. The difference between the two is what a caller
    /// gets wrong silently if it is left to a name, so it is a parameter.
    enum Spelling {
        /// Every folder named is asked about again, and every folder not named is forgotten. For
        /// the caller that names them all — the worktree sweep, which sees both the repository and
        /// the roster. Asking again is what keeps a repointed symlink from being answered out of a
        /// table that has no other reason to change.
        case theWholeTable
        /// Only folders nothing has spelled yet are asked about, and the rest of the table stands.
        /// For a caller that names some of them: the liveness poll, which sees the roster and not
        /// the repository, and the two moments a folder joins the roster between sweeps — a spawn,
        /// and a batch landing in the join.
        case foldersNotYetSpelled

        var reusesWhatIsHeld: Bool {
            self == .foldersNotYetSpelled
        }

        var forgetsTheRest: Bool {
            self == .theWholeTable
        }
    }

    /// How the file system spells one path, and the path itself where nothing has spelled it yet.
    ///
    /// Degrade-down: an unspelled folder matches no live process and no worktree, which is the
    /// quieter answer. Nothing should reach it in practice — every way a folder joins the roster
    /// spells it — and the callers that close those windows are named on `Spelling` above.
    func spelled(_ path: String) -> String {
        resolved[path] ?? path
    }

    /// Spell these folders, asking the file system in ONE batch and off the main actor.
    func spell(_ paths: [String], settling extent: Spelling) async {
        // The pointed Project's own root is in EVERY batch, whoever the caller is: the roster
        // compares a spawn's folder against it, and a root the table cannot answer for would
        // degrade to the string a registration carried while the folder beside it is resolved —
        // two spellings of one directory, and no provisional row inside it (#363).
        var named = paths
        if let root = repositoryURL()?.path {
            named.append(root)
        }
        let held = extent.reusesWhatIsHeld ? resolved : [:]
        let unspelled = Set(named.filter { held[$0] == nil })
        let read = unspelled.isEmpty ? [:] : await engine.resolvedPaths(Array(unspelled))
        let spelling = named.reduce(into: [String: String]()) { table, path in
            table[path] = read[path] ?? held[path]
        }
        publish(extent.forgetsTheRest ? spelling : resolved.merging(spelling) { _, new in new })
    }

    /// Written only where a spelling moved, for `publish(workspaces:)`'s reason: the table is
    /// observed, so a folder spelled for the first time re-renders the row that reads it — and
    /// where git said the same thing as last time, nothing else would.
    private func publish(_ table: [String: String]) {
        guard table != resolved else { return }
        resolved = table
    }
}
