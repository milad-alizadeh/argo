import ArgoDesign
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
        /// The one fact on that second line that tells this Session from the rows beside it, at
        /// the leading edge: the slash command it opened with where the Ticket holds the title
        /// (#745), and the Ticket itself where the title fell back to the Session's own derived
        /// name (#1072). Never both — the slot says whatever the title is not saying, and a row
        /// with nothing left to add draws nothing.
        let toldApart: String?
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
            self.toldApart = work.toldApart
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
                toldApart,
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

    private static func rows(
        from sessions: [CockpitPresentation.Session], archived: Bool, now: Date,
    )
        -> [Row] {
        let nowMs = now.epochMs
        // Decided before the split and filtered after: the kept rows and the archived ones are
        // drawn in one column, so a Session told apart only from its own list would come out
        // reading the same as one in the other.
        return zip(sessions, decided(across: sessions))
            .filter { session, _ in session.isArchived == archived }
            .map { session, decided in row(for: session, decided: decided, nowMs: nowMs) }
    }

    /// What the two whole-roster passes settled for one Session: the name it draws and the label
    /// its workspace goes by. Neither is answerable from the Session alone.
    private struct Decided {
        let naming: SessionTitle.Naming
        let worktree: String?
    }

    private static func decided(across sessions: [CockpitPresentation.Session]) -> [Decided] {
        zip(SessionTitle.namings(across: sessions), worktrees(of: sessions)).map(Decided.init)
    }

    private static func row(
        for session: CockpitPresentation.Session, decided: Decided, nowMs: Int,
    )
        -> Row {
        let clock = clock(for: session, nowMs: nowMs)
        return Row(
            identity: Row.Identity(
                id: session.id,
                // The name the user set, ahead of the issue's and the derived one (#502, story 19)
                // — and the issue's only where it names this row alone (#1072).
                title: decided.naming.title,
                rename: SessionRenameProjection.rename(for: session, naming: decided.naming),
            ),
            work: Row.Work(
                location: session.workspaceLocation,
                worktree: decided.worktree,
                branch: session.workspace?.branch,
                toldApart: toldApart(for: session, naming: decided.naming),
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

    /// The first fact the title is not already saying, in the row's one leading meta slot.
    ///
    /// The Ticket, where the title fell back to the derived name or the user renamed the row — it
    /// is then the fact the row is missing (#1072). The slash command otherwise, which is where
    /// the ticket freeing the title put it (#745). Nothing at all for a row whose title already
    /// carries both, like `/implement 741`, because saying either twice is the waste #745 named.
    private static func toldApart(
        for session: CockpitPresentation.Session, naming: SessionTitle.Naming,
    )
        -> String? {
        if let number = session.ticket.link?.number,
           !IssueReading.names(number: number, in: naming.title) {
            return IssueReading.words(number: number, title: nil)
        }
        guard !naming.drawsDerivedTitle else { return nil }
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
