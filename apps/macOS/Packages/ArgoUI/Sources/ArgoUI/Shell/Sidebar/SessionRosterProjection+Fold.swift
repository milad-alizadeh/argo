import ArgoEngine

/// The Roster's folds (`CONTEXT.md` "Not domain entities" · Fold) — split off
/// `SessionRosterProjection.swift` so neither file owns two subjects.
extension SessionRosterProjection {
    /// What a folded row stands for. Carried on `Row.Identity`, because it is what the row IS: a
    /// fold has no Session behind it, so nothing may address it as one.
    struct Fold: Equatable {
        /// The fold's own id, which names a directory and a list, and never a Session.
        let id: String
        /// How many runs are under it. Never one — see `Folding.least`.
        let count: Int
        /// The shortest name for the directory that tells it from the other folds on the roster.
        let label: String
        /// Whether its runs are drawn as rows of their own right now.
        let isOpen: Bool
    }

    /// Every fold these Sessions draw a row for, by the id `rows(from:opened:)` opens one BY —
    /// so a caller never spells `fold:<list>:<dir>` itself and drifts from it.
    package static func foldIDs(from sessions: [CockpitPresentation.Session]) -> Set<String> {
        Set(rows(from: sessions).compactMap { $0.fold?.id })
    }

    /// The folds one roster pass settles, decided ONCE across the list rather than per row
    /// (ADR-0028): which fold a run belongs to is a property of the whole list, and asking it per
    /// row reads every other row once per row.
    ///
    /// A run reaches `membership` only where its directory actually folded, so the two answers
    /// below cannot disagree: every run is either inside a fold that draws a row or on a row of
    /// its own, and none can fall between the two.
    struct Folding {
        /// A fold of one saves no row and costs a name, so a lone run keeps its own row.
        static let least = 2

        /// One folded directory: how many runs it holds, the label it is captioned by, and the
        /// run whose place it takes — the first of the group, which, the Hub publishing
        /// newest-activity-first, is its newest.
        struct Reading {
            let count: Int
            let label: String
            let leader: String
        }

        /// Which directory each FOLDED run belongs to. A run drawn on its own row is absent.
        private let membership: [String: String]
        private let folds: [String: Reading]
        /// Every id a directory folds, in roster order — what a fold's OWN reading pools across
        /// (`SessionRosterProjection.foldedSubagents`), kept apart from `folds` because that is
        /// the count and the label alone.
        private let runsByDirectory: [String: [String]]
        private let opened: Set<String>
        /// Which of the roster's two lists this pass drew. In the id because a directory with runs
        /// on both would otherwise have one id for two rows, and opening either would open both.
        private let list: String

        init(of sessions: [CockpitPresentation.Session], in pass: SessionRosterProjection.Pass) {
            let groups = Self.groups(of: sessions)
            let members = Dictionary(
                uniqueKeysWithValues: groups.flatMap { group in
                    group.runs.map { ($0, group.directory) }
                },
            )
            let list = pass.isArchived ? "archived" : "roster"
            // A fold holding the selection is open whether or not the reader opened it, for the
            // reason the archive foot is (`isArchiveOpen`): the deck draws what the selection
            // names, and a fold shut over it would leave the roster drawing no row for the
            // Session the feed is drawing.
            let selected = pass.selection.flatMap { members[$0] }
            self.list = list
            self.membership = members
            self.folds = Dictionary(uniqueKeysWithValues: groups.map { ($0.directory, $0.reading) })
            self.runsByDirectory = Dictionary(
                uniqueKeysWithValues: groups.map { ($0.directory, $0.runs) },
            )
            self.opened = pass.opened
                .union(selected.map { [Self.identifier(of: $0, in: list)] } ?? [])
        }

        /// The fold this Session OPENS — the one whose leading run it is — and `nil` for every
        /// other row. What draws a fold once, at the place its newest run had.
        func fold(opening session: CockpitPresentation.Session) -> Fold? {
            guard let directory = membership[session.id], let reading = folds[directory],
                  reading.leader == session.id
            else { return nil }
            let id = identifier(of: directory)
            return Fold(
                id: id, count: reading.count, label: reading.label, isOpen: opened.contains(id),
            )
        }

        /// Whether this Session is drawn on a row of its own: every run outside a fold, and every
        /// run inside one that is open.
        func drawsOwnRow(_ session: CockpitPresentation.Session) -> Bool {
            guard let directory = membership[session.id] else { return true }
            return opened.contains(identifier(of: directory))
        }

        /// Every run the fold this Session opens hides — what its own reading pools across
        /// (`SessionRosterProjection.foldedSubagents`). Empty for a Session that opens no fold.
        func runs(foldedWith session: CockpitPresentation.Session) -> [String] {
            guard let directory = membership[session.id] else { return [] }
            return runsByDirectory[directory] ?? []
        }

        private func identifier(of directory: String) -> String {
            Self.identifier(of: directory, in: list)
        }

        /// A fold's id, off its directory and its list, and prefixed so it can never collide with
        /// a Session's: nothing on the roster may name a fold and a Session with one word.
        private static func identifier(of directory: String, in list: String) -> String {
            "fold:\(list):\(directory)"
        }
    }
}

private extension SessionRosterProjection.Folding {
    /// One directory's headless runs, in the order the roster lists them.
    struct Candidate {
        let directory: String
        let runs: [String]
    }

    /// A candidate that earned a fold, and what its fold says.
    struct Group {
        let directory: String
        let runs: [String]
        let reading: Reading
    }

    /// Every directory that folds, with the label it is captioned by.
    ///
    /// The labels are decided across the folds TOGETHER, so two loops running in folders of the
    /// same name are told apart rather than both reading `prototypes`.
    ///
    /// A candidate whose path has no component to name it by does not fold at all: its runs keep
    /// their own rows, rather than falling out of the roster between the two answers below.
    static func groups(of sessions: [CockpitPresentation.Session]) -> [Group] {
        let candidates = grouped(sessions).filter { $0.runs.count >= least }
        return zip(candidates, DistinguishingLabel.labels(for: candidates.map(\.directory)))
            .compactMap { candidate, label in
                guard let label, let leader = candidate.runs.first else { return nil }
                return Group(
                    directory: candidate.directory,
                    runs: candidate.runs,
                    reading: Reading(
                        count: candidate.runs.count, label: label, leader: leader,
                    ),
                )
            }
    }

    /// The `headless` runs grouped by working directory, directories in the order their first run
    /// appears — which is the order the fold rows are then drawn in.
    ///
    /// The transcript directory the CLI writes into is a mangling of this same folder, so this is
    /// the grouping #1073 asked for said in a fact the cockpit already holds: ADR-0027 leaves the
    /// file path in the engine (`not-projected: sourceURL`).
    ///
    /// Two runs are left out, both by degrade-down. One Argo read no directory for has nothing to
    /// be folded into; one Argo owns the terminal of can be TYPED at, whatever its record said it
    /// was started as, and a Session anybody can drive is never folded away.
    static func grouped(_ sessions: [CockpitPresentation.Session]) -> [Candidate] {
        var order: [String] = []
        var runs: [String: [String]] = [:]
        for session in sessions where session.entry == .headless && session.access != .managed {
            guard let directory = session.workspaceLocation else { continue }
            if runs[directory] == nil {
                order.append(directory)
            }
            runs[directory, default: []].append(session.id)
        }
        return order.map { Candidate(directory: $0, runs: runs[$0] ?? []) }
    }
}
