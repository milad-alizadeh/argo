import ArgoEngine

/// The Roster's folds (`CONTEXT.md` "Not domain entities" · Fold) — split off
/// `SessionRosterProjection.swift` so neither file owns two subjects.
extension SessionRosterProjection {
    /// What a folded row stands for. Carried on `Row.Identity`, because it is what the row IS: a
    /// fold has no Session behind it, so nothing may address it as one.
    struct Fold: Equatable {
        /// The fold's own id, which is its directory and never a Session's.
        let id: String
        /// How many runs are under it. Never one — see `Folding.least`.
        let count: Int
        /// The shortest name for the directory that tells it from the other folds on the roster.
        let label: String
        /// Whether its runs are drawn as rows of their own right now.
        let isOpen: Bool
    }

    /// The folds one roster pass settles, decided ONCE across the list rather than per row
    /// (ADR-0028): which fold a run belongs to is a property of the whole list, and asking it per
    /// row reads every other row once per row.
    ///
    /// Every field is a lookup taken in `init`, so a pass over 328 Sessions builds this once and
    /// answers each row from it.
    struct Folding {
        /// A fold of one saves no row and costs a name, so a lone run keeps its own row.
        private static let least = 2

        /// Which directory each folded run belongs to. A run drawn on its own row is absent.
        private let membership: [String: String]
        private let counts: [String: Int]
        private let labels: [String: String]
        /// The run whose place each fold takes: the first of the group, which — the Hub publishing
        /// newest-activity-first — is its newest.
        private let leaders: [String: String]
        private let opened: Set<String>

        init(of sessions: [CockpitPresentation.Session], opened: Set<String>) {
            let folded = Self.grouped(sessions).filter { $0.runs.count >= Self.least }
            let labelled = zip(folded, DistinguishingLabel.labels(for: folded.map(\.directory)))
            self.membership = Dictionary(
                uniqueKeysWithValues: folded.flatMap { group in
                    group.runs.map { ($0, group.directory) }
                },
            )
            self.counts = Dictionary(
                uniqueKeysWithValues: folded.map { ($0.directory, $0.runs.count) },
            )
            self.labels = Dictionary(
                uniqueKeysWithValues: labelled.compactMap { group, label in
                    label.map { (group.directory, $0) }
                },
            )
            self.leaders = Dictionary(
                uniqueKeysWithValues: folded.compactMap { group in
                    group.runs.first.map { (group.directory, $0) }
                },
            )
            self.opened = opened
        }

        /// The fold this Session OPENS — the one whose leading run it is — and `nil` for every
        /// other row. What draws a fold once, at the place its newest run had.
        func fold(opening session: CockpitPresentation.Session) -> Fold? {
            guard let directory = membership[session.id], leaders[directory] == session.id,
                  let count = counts[directory], let label = labels[directory]
            else { return nil }
            let id = Self.identifier(of: directory)
            return Fold(id: id, count: count, label: label, isOpen: opened.contains(id))
        }

        /// Whether this Session is drawn on a row of its own: every run outside a fold, and every
        /// run inside one the reader has opened.
        func drawsOwnRow(_ session: CockpitPresentation.Session) -> Bool {
            guard let directory = membership[session.id] else { return true }
            return opened.contains(Self.identifier(of: directory))
        }

        /// One directory's headless runs, in the order the roster lists them.
        private struct Group {
            let directory: String
            let runs: [String]
        }

        /// The `headless` runs grouped by working directory, directories in the order their first
        /// run appears — which is the order the fold rows are then labelled and drawn in.
        ///
        /// The transcript directory the CLI writes into is a mangling of this same folder, so this
        /// is the grouping #1073 asked for said in a fact the cockpit already holds: ADR-0027
        /// leaves the file path in the engine (`not-projected: sourceURL`).
        ///
        /// A run Argo read no directory for is not folded: there is nothing to fold it into, and
        /// the quiet answer is its own row (degrade-down).
        private static func grouped(_ sessions: [CockpitPresentation.Session]) -> [Group] {
            var order: [String] = []
            var runs: [String: [String]] = [:]
            for session in sessions where session.entry == .headless {
                guard let directory = session.workspaceLocation else { continue }
                if runs[directory] == nil {
                    order.append(directory)
                }
                runs[directory, default: []].append(session.id)
            }
            return order.map { Group(directory: $0, runs: runs[$0] ?? []) }
        }

        /// A fold's id, taken off its directory and prefixed so it can never collide with a
        /// Session's: nothing on the roster may name a fold and a Session with one word.
        private static func identifier(of directory: String) -> String {
            "fold:\(directory)"
        }
    }
}
