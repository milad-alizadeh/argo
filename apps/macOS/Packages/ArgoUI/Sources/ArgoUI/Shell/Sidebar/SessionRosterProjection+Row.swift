import ArgoDesign
import ArgoEngine
import Foundation

/// One roster row and the two passes that build one — split off `SessionRosterProjection.swift`
/// so neither file owns two subjects. The `Row` and everything that constructs one sit together,
/// which is what keeps its initializer `fileprivate`.
extension SessionRosterProjection {
    package struct Row: Identifiable, Sendable {
        package let id: String
        let title: String
        /// Never drawn, and no longer hovered either (#1199): an absolute path is the widest
        /// thing a row could hand a reader and says least about which run to open. The copy
        /// action is what still addresses the Session by it.
        let location: String?
        /// Which worktree this Session is in, named by the shortest suffix that tells it apart
        /// from the others on the roster. **Spoken and never drawn** (#1199) — the header is
        /// where a reader who has selected the Session reads the checkout.
        ///
        /// Absent for a Session in the Project's own checkout, and absent again where Argo has
        /// not read git — a label is a claim that the folder IS a worktree.
        private let spokenWorktree: String?
        /// What the Session is doing at this second, while it is running: the newest call in its
        /// record, verb and subject, in the feed's own words (`activity(of:)`). `nil` for every
        /// other status and for a running Session that has emitted no call — the slot then keeps
        /// `toldApart` below.
        ///
        /// Read only through `secondaryFact` on the row itself: the line has one arrangement now,
        /// so which of the two facts fills the slot no longer changes where anything sits (#1291).
        let activity: String?
        /// The one fact on that second line that tells this Session from the rows beside it:
        /// the slash command it opened with where the Ticket holds the title
        /// (#745), and the Ticket itself where the title fell back to the Session's own derived
        /// name (#1072). Never both — the slot says whatever the title is not saying, and a row
        /// with nothing left to add draws nothing.
        let toldApart: String?
        /// Never drawn either: the branch belongs to the session header. Kept so the row's copy
        /// action can still hand it over.
        let branch: String?
        /// The Ticket this row addresses, drawn at the trailing edge of line 3 — `nil` for a
        /// Session on none, and for a fold, which stands for several at once (`DeliveryAddresses`).
        let ticketNumber: Int?
        /// The pull request the same branch is the life of, beside `ticketNumber` on line 3 —
        /// `nil` for a branch with none open, and for a fold.
        let pullRequest: DeliveryPullRequest?
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
        /// The OPEN Turn's own start, kept apart from `clock`'s Session-wide reading (#1330) —
        /// what the dot's pulse ages off (#1291). `nil` wherever `clock` is, and also on a
        /// managed Session running for hours whose newest Turn Argo cannot anchor.
        private let turnStartedAtMs: Int?
        let state: ArgoOperationalState?
        /// The dot carries `running`, `idle` and `ended`; a word is spent only where the roster
        /// needs the user to stop scanning.
        let stateWord: String?
        /// Line 3's `PlanBar` — the same reading the Session's own plan pill shows. `nil` for a
        /// Session that has never written a Plan, and always `nil` on a fold (`foldRow`): four
        /// to-do lists do not add up to one.
        let plan: PlanReading?
        /// What runs under this Session, drawn beneath the state dot (`SessionMarker`,
        /// `SubagentDots`).
        let subagents: SubagentReading?
        /// Which of the roster's two lists this row belongs to — and, on the row itself, which
        /// way its swipe goes: a row on the roster archives, a row under the foot comes back.
        let isArchived: Bool
        /// What the dialog behind a double-click on the title opens with. Carried ON the row, so
        /// the dialog can never name something other than the line that was clicked. `nil` on a
        /// fold, which stands for many Sessions and so has no name of its own to change.
        let rename: SessionRenameProjection.Rename?
        /// What this row stands for, where it is not one Session — see `Fold`. `nil` on every
        /// ordinary row, which is what every surface reads to tell the two apart.
        let fold: Fold?

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
            self.fold = identity.fold
            self.location = work.location
            self.spokenWorktree = work.worktree
            self.toldApart = work.toldApart
            self.branch = work.branch
            self.ticketNumber = work.ticketNumber
            self.pullRequest = work.pullRequest
            self.isReadOnly = availability.isReadOnly
            self.lock = availability.lock
            self.isArchived = availability.isArchived
            self.clock = activity.clock
            self.spokenClock = activity.spokenClock
            self.turnStartedAtMs = activity.turnStartedAtMs
            self.state = activity.state
            self.stateWord = activity.stateWord
            self.activity = activity.activity
            self.plan = activity.plan
            self.subagents = activity.subagents
        }

        /// The one fact line 2 carries, first match wins (#1199): what the Session is doing right
        /// now while it is running, and the fact that tells it apart from its neighbours
        /// otherwise. One slot, so the line never says both, and no fact means no line (#1343).
        var secondaryFact: String? {
            activity ?? toldApart
        }

        /// When the open Turn began, where Argo owns the stamp — what the dot's pulse ages off, so
        /// a Turn six minutes in beats at the rung its age has earned rather than at the one the
        /// row's own first frame would give it (#1291).
        ///
        /// `nil` for every other reading of the slot: an observed Session's `output … ago` is when
        /// a record last LANDED, and ageing a wait off that would claim a Turn start Argo never
        /// saw. Those rows fall back to when the row appeared, which is the feed's own answer.
        var turnStartedAt: Date? {
            turnStartedAtMs.map(Date.init(epochMs:))
        }

        /// What a screen reader hears: the same `stateWord` the row draws, plus the read-only
        /// fact, which the row spends on ink a screen reader has no way to hear.
        var announcement: String {
            [
                title,
                stateWord,
                fold.map { $0.isOpen ? "Expanded" : "Collapsed" },
                isReadOnly ? readOnlyPhrase : nil,
                secondaryFact,
                spokenWorktree.map { "in \($0)" },
                spokenClock,
            ]
            .compactMap(\.self)
            .joined(separator: ", ")
        }

        /// A fold is read-only because nothing under it can be typed at, which is a different
        /// sentence from a Session Argo does not own the terminal of.
        private var readOnlyPhrase: String {
            fold == nil ? "Read-only Session" : "Headless runs"
        }
    }

    /// The row a fold draws: what it stands for in the title, the folder it folded in the slot the
    /// roster tells rows apart by, and its newest run's own clock.
    static func foldRow(
        _ fold: Fold,
        at newest: CockpitPresentation.Session,
        of runs: [CockpitPresentation.Session],
        nowMs: Int,
    )
        -> Row {
        let clock = clock(for: newest, in: newest.events, nowMs: nowMs)
        return Row(
            identity: Row.Identity(
                id: fold.id, title: "\(fold.count) runs", rename: nil, fold: fold,
            ),
            work: Row.Work(
                location: newest.workspaceLocation, worktree: nil, branch: nil,
                // A fold stands for several runs at once — see the doc comment on `Row`, which is
                // why it draws neither address.
                meta: Row.Work.Meta(toldApart: fold.label, ticketNumber: nil, pullRequest: nil),
            ),
            activity: Row.Activity(
                // No dot and no word: a fold stands for runs in several states at once, and one
                // of them drawn for all of them is a claim about the others.
                dot: Row.Activity.Dot(state: nil, word: nil),
                age: Row.Activity.Age(
                    clock: clock, spoken: spokenClock(clock, nowMs: nowMs),
                    // No dot on a fold either (above), so no Turn pulse to pace.
                    turnStartedAtMs: nil,
                ),
                doing: Row.Activity.Doing(
                    // A fold stands for several runs at once, so one run's call drawn for all of
                    // them is the same claim about the others its dot and its word decline to
                    // make.
                    activity: nil,
                    // A fold sums or says nothing: its Plan is nobody's to draw, and four to-do
                    // lists do not add up to one (`cockpit-roster-row.md`, rule 9).
                    plan: nil,
                ),
                // A fold sums or says nothing (rule 9): its dots are pooled across every run it
                // hides, under the same ceiling, and never the other three readings.
                subagents: foldedSubagents(of: runs),
            ),
            availability: Row.Availability(
                // Nothing under a fold can be typed at, and the padlock says exactly that.
                isReadOnly: true, lock: ArgoSymbol.readOnlySession,
                isArchived: newest.isArchived,
            ),
        )
    }

    static func row(
        for session: CockpitPresentation.Session, decided: Decided, nowMs: Int,
    )
        -> Row {
        // Handed out ONCE and walked twice: the clock and the activity both read the tail of the
        // same stream, and the selection pass is gated on hand-outs (`PerfBudgets`).
        let events = session.events
        let clock = clock(for: session, in: events, nowMs: nowMs)
        return Row(
            identity: Row.Identity(
                id: session.id,
                // The name the user set, ahead of the issue's and the derived one (#502, story 19)
                // — and the issue's only where it names this row alone (#1072).
                title: decided.naming.title,
                rename: SessionRenameProjection.rename(for: session, naming: decided.naming),
                fold: nil,
            ),
            work: Row.Work(
                location: session.workspaceLocation,
                worktree: decided.worktree,
                branch: session.workspace?.branch,
                meta: Row.Work.Meta(
                    toldApart: toldApart(for: session, naming: decided.naming),
                    ticketNumber: session.ticket.link?.number,
                    pullRequest: session.pullRequest,
                ),
            ),
            activity: Row.Activity(
                dot: Row.Activity.Dot(
                    state: SessionState.role(for: session.status),
                    word: SessionState.word(for: session.status),
                ),
                age: Row.Activity.Age(
                    clock: clock, spoken: spokenClock(clock, nowMs: nowMs),
                    turnStartedAtMs: openTurnStartedAtMs(for: session, in: events),
                ),
                doing: Row.Activity.Doing(
                    activity: activity(of: session, in: events),
                    // Off the same hand-out the clock and the activity above already walked,
                    // not a second `session.events` (`PerfBudgets`).
                    plan: PlanProjection.reading(from: events),
                ),
                subagents: subagents(of: session, in: events),
            ),
            availability: Row.Availability(
                isReadOnly: isReadOnly(session.access),
                lock: lock(for: session.access),
                isArchived: session.isArchived,
            ),
        )
    }
}
