import ArgoEngine
import Foundation

enum SessionRosterProjection {
    struct Row: Identifiable, Sendable {
        let id: String
        let title: String
        /// Never drawn — the worktree label stands in for it — but the tooltip and the copy
        /// actions still address the Session by it.
        let location: String?
        /// The row's second line: which worktree this Session is in, named by the shortest
        /// suffix that tells it apart from the others on the roster.
        ///
        /// Absent for a Session in the Project's own checkout, and absent again where Argo has
        /// not read git — a label is a claim that the folder IS a worktree.
        let worktree: String?
        /// The slash command this Session opened with, on the same second line (#745). Absent for
        /// a Session whose title IS that command already — the roster's own defect was every row
        /// leading with `/implement`, and saying it twice on one row is the same waste.
        let runKind: String?
        /// Never drawn either: the branch belongs to the session header. Kept so the row's copy
        /// action can still hand it over.
        let branch: String?
        /// True of every Session Argo does not own the terminal of, and always announced. Drawn by
        /// ghosting the whole row — title, branch, age and dot.
        let isReadOnly: Bool
        /// The mark on a Session that can never be typed into, and `nil` on every other row —
        /// narrower than `isReadOnly`, which ghosts an orphaned row too (#743).
        let lock: String?
        /// The age slot's one reading (`cockpit-roster-turn-clock.md`): a live Turn duration for
        /// a managed running Session, `output … ago` for an observed one mid-turn, and how long
        /// ago the Session was last seen otherwise. Absent only where no record carries a time.
        let clock: Clock?
        /// The clock as words, fixed at projection time — what `announcement` says for it.
        private let spokenClock: String?
        let state: ArgoOperationalState?
        /// The dot carries `running`, `idle` and `ended`; a word is spent only where the roster
        /// needs the user to stop scanning.
        let stateWord: String?
        /// Which of the roster's two lists this row belongs to — and, on the row itself, which
        /// way its swipe goes: a row on the roster archives, a row under the foot comes back.
        let isArchived: Bool
        /// What the dialog behind a double-click on the title opens with. Carried ON the row, so
        /// the dialog can never name something other than the line that was clicked.
        let rename: SessionRenameProjection.Rename

        /// `fileprivate`, so `rows(from:)` is the only way a Row comes into being. Taken as one
        /// value per reading (`SessionRosterProjection+RowValues.swift`) and unpacked onto the flat
        /// slots above, which is the shape every surface draws a row through.
        fileprivate init(
            identity: Identity,
            work: Work,
            activity: Activity,
            availability: Availability,
        ) {
            self.id = identity.id
            self.title = identity.title
            self.rename = identity.rename
            self.location = work.location
            self.worktree = work.worktree
            self.runKind = work.runKind
            self.branch = work.branch
            self.isReadOnly = availability.isReadOnly
            self.lock = availability.lock
            self.isArchived = availability.isArchived
            self.clock = activity.clock
            self.spokenClock = activity.spokenClock
            self.state = activity.state
            self.stateWord = activity.stateWord
        }

        /// What a screen reader hears: the same `stateWord` the row draws, plus the read-only
        /// fact, which the row spends on ink a screen reader has no way to hear.
        var announcement: String {
            [
                title,
                stateWord,
                isReadOnly ? "Read-only Session" : nil,
                runKind,
                worktree.map { "in \($0)" },
                spokenClock,
            ]
            .compactMap(\.self)
            .joined(separator: ", ")
        }
    }

    /// The roster proper: everything the user has not cleared off it.
    ///
    /// The filter is on Argo's own flag and on nothing observed, so a Session whose transcript
    /// grew a second ago is as absent as one that has not moved in a week (#502, stories 14, 16).
    ///
    /// `now` is a parameter so an age is arithmetic against a fixed moment rather than the clock.
    static func rows(from sessions: [CockpitPresentation.Session], now: Date = Date()) -> [Row] {
        rows(from: sessions, archived: false, now: now)
    }

    /// What is behind the foot of the roster. The same rows by the same rules — a Session put out
    /// of sight is not a Session described differently.
    static func archivedRows(
        from sessions: [CockpitPresentation.Session], now: Date = Date(),
    )
        -> [Row] {
        rows(from: sessions, archived: true, now: now)
    }

    /// What the foot of the roster says, read and heard — one value, so nothing guards the same
    /// emptiness twice.
    struct Foot: Equatable {
        let label: String
        let announcement: String
    }

    /// Whether the roster draws what is behind its foot — the reader's own toggle, OR the selection
    /// sitting back there.
    ///
    /// The second clause is the roster's decision and not the view's, which is why it is here where
    /// a test can reach it. The deck renders whatever the selection names, so a foot shut over the
    /// selected Session leaves the roster drawing NO row for the Session the feed is drawing: the
    /// two surfaces then name two different Sessions, which `CONTEXT.md` Honesty tier forbids.
    /// Archiving the row being read is the way into that state.
    static func isArchiveOpen(showing: Bool, selection: String?, in archived: [Row]) -> Bool {
        guard let selection, !showing else { return showing }
        return archived.contains { $0.id == selection }
    }

    /// The foot, and `nil` where there is nothing behind it (`cockpit-spec.md` §4.1).
    static func archivedFoot(_ archived: [Row]) -> Foot? {
        guard archived.isEmpty == false else { return nil }
        let count = archived.count
        return Foot(
            label: "Archived (\(count))",
            // Said in words for the reader who is hearing it, because `(2)` reads out as
            // punctuation.
            announcement: "Archived, \(count) Session\(count == 1 ? "" : "s")",
        )
    }

    private static func rows(
        from sessions: [CockpitPresentation.Session], archived: Bool, now: Date,
    )
        -> [Row] {
        let nowMs = now.epochMs
        // Labelled before the split and filtered after: the kept rows and the archived ones are
        // drawn in one column, so a worktree told apart only from its own list would come out
        // reading the same as one in the other.
        return zip(sessions, worktrees(of: sessions))
            .filter { session, _ in session.isArchived == archived }
            .map { session, worktree in
                let clock = clock(for: session, nowMs: nowMs)
                return Row(
                    identity: Row.Identity(
                        id: session.id,
                        // The name the user set, ahead of the issue's and the derived one
                        // (#502, story 19).
                        title: SessionTitle.resolved(for: session),
                        rename: SessionRenameProjection.rename(for: session),
                    ),
                    work: Row.Work(
                        location: session.workspaceLocation,
                        worktree: worktree,
                        branch: session.workspace?.branch,
                        runKind: runKind(for: session),
                    ),
                    activity: Row.Activity(
                        state: SessionState.role(for: session.status),
                        stateWord: SessionState.word(for: session.status),
                        clock: clock,
                        spokenClock: spokenClock(clock, nowMs: nowMs),
                    ),
                    availability: Row.Availability(
                        isReadOnly: isReadOnly(session.access),
                        lock: lock(for: session.access),
                        isArchived: session.isArchived,
                    ),
                )
            }
    }

    /// The label each row spends on its workspace, decided across the WHOLE roster in one pass:
    /// how short a name can be and still tell one Session apart depends on its neighbours.
    ///
    /// Every row that draws no label is dropped BEFORE the labels are decided, so a silent row
    /// cannot push the worktree rows into longer names.
    ///
    /// Which folders are worktrees is git's answer (`WorkspaceProjection.Kind`), not a shape read
    /// off the path — Argo's worktrees live INSIDE the checkout they branch from, so no amount
    /// of prefix-matching separates the two.
    private static func worktrees(of sessions: [CockpitPresentation.Session]) -> [String?] {
        DistinguishingLabel.labels(for: sessions.map {
            $0.workspace?.kind == .worktree ? $0.workspaceLocation : nil
        })
    }

    /// The verb, on the secondary line and only where the title is not already saying it (#745):
    /// the ticket freed the title, and a row whose title is still `/implement 745` would otherwise
    /// read the command twice.
    private static func runKind(for session: CockpitPresentation.Session) -> String? {
        guard !SessionTitle.drawsDerivedTitle(for: session) else { return nil }
        return SessionRunKind.command(inDerivedTitle: session.title)
    }

    /// Whether the whole row is drawn as a Session nobody here can drive. A `switch` and not
    /// `!= .managed`, so a posture added to this axis has to answer the question.
    private static func isReadOnly(_ access: CockpitPresentation.Session.Access) -> Bool {
        switch access {
        case .managed: false
        case .external, .orphaned: true
        }
    }

    /// `orphaned` is ghosted without a mark: selecting one resumes the chain (ADR-0026), so a
    /// padlock on it would be a lie.
    private static func lock(for access: CockpitPresentation.Session.Access) -> String? {
        switch access {
        case .external: ArgoSymbol.readOnlySession
        case .managed, .orphaned: nil
        }
    }
}
