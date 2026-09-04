import ArgoDesign
import ArgoEngine

/// What a Row is assembled from — one value per reading it comes from (#755, #999), the way
/// `CockpitPresentation.Session` is. The Row itself stays flat: every surface that draws a row
/// reads `row.title` and `row.clock`, and a grouping is how the facts ARRIVE rather than a second
/// shape for them to be read through.
extension SessionRosterProjection.Row {
    /// What names this row — and, on `rename`, the same name in the form the dialog behind a
    /// double-click opens with. A fold is named by what it stands for instead, so it carries no
    /// rename and its `fold` says how many runs are under it.
    struct Identity {
        let id: String
        let title: String
        let rename: SessionRenameProjection.Rename?
        /// What the row stands for where it is not one Session — `nil` on every ordinary row.
        let fold: SessionRosterProjection.Fold?
    }

    /// What the Session is working on: the folder it runs in, the label the roster SPEAKS that
    /// folder by, its branch, and the facts beyond the branch itself — the meta line's fallback
    /// and the two addresses line 3 answers to.
    struct Work {
        let location: String?
        let worktree: String?
        let branch: String?
        let toldApart: String?
        /// The Ticket this row addresses, `nil` for a Session on none (`cockpit-roster-row.md` —
        /// `DeliveryAddresses`). Read once here rather than a second time off `session.ticket` at
        /// draw time.
        let ticketNumber: Int?
        /// The pull request the same branch is the life of, `nil` for one with none open.
        let pullRequest: DeliveryPullRequest?

        /// What the row says beyond its own branch: the meta line's fallback and the two
        /// addresses — one parameter rather than three, since the cap (`rules/house.md`, edge 6)
        /// never bends for a fourth reading arriving after the first three were already at it.
        struct Meta {
            let toldApart: String?
            let ticketNumber: Int?
            let pullRequest: DeliveryPullRequest?
        }

        init(location: String?, worktree: String?, branch: String?, meta: Meta) {
            self.location = location
            self.worktree = worktree
            self.branch = branch
            self.toldApart = meta.toldApart
            self.ticketNumber = meta.ticketNumber
            self.pullRequest = meta.pullRequest
        }
    }

    /// What the Session is doing right now, drawn and spoken — the dot's reading, its word, the
    /// one age slot in both forms, and the newest call in its record while it is running (#1199).
    struct Activity {
        /// The state dot's own reading, in both its forms — the colour role `SessionState.role`
        /// settles and the word `SessionState.word` spends, read off the same status at the same
        /// time, which is what makes them one parameter rather than two.
        struct Dot {
            let state: ArgoOperationalState?
            let word: String?
        }

        /// The one age slot in both its forms. They are read off the same moment at the same
        /// time and no call site names one without the other, which is what makes them one
        /// parameter rather than two.
        struct Age {
            let clock: SessionRosterProjection.Clock?
            /// The clock as words, fixed at projection time — what the announcement says for it.
            let spoken: String?
        }

        /// What the Session is doing right now, in both the words it left behind and the list it
        /// is working from — read off the same tail of events at the same time (`row(for:)`).
        struct Doing {
            let activity: String?
            /// The agent's live to-do list, read off the same events `activity` already walked
            /// (`PlanProjection.reading(from:)`) — `nil` for a Session that has never written
            /// one, drawn exactly alike (`cockpit-roster-row.md`, `PlanBar`).
            let plan: PlanReading?
        }

        let state: ArgoOperationalState?
        let stateWord: String?
        let clock: SessionRosterProjection.Clock?
        let spokenClock: String?
        /// `nil` on every row that is not a running Session with a call behind it — see
        /// `SessionRosterProjection.activity(of:in:)`.
        let activity: String?
        let plan: PlanReading?
        /// What runs under this Session, or a fold of several
        /// (`SessionRosterProjection.subagents`).
        /// `nil` where `state` is, and for the same reason (rule 5).
        let subagents: SessionRosterProjection.SubagentReading?

        init(
            dot: Dot,
            age: Age,
            doing: Doing,
            subagents: SessionRosterProjection.SubagentReading? = nil,
        ) {
            self.state = dot.state
            self.stateWord = dot.word
            self.clock = age.clock
            self.spokenClock = age.spoken
            self.activity = doing.activity
            self.plan = doing.plan
            self.subagents = subagents
        }
    }

    /// What the reader may do with the row: drive the Session or only watch it, and whether the
    /// row is on the roster or behind its foot.
    struct Availability {
        let isReadOnly: Bool
        let lock: String?
        let isArchived: Bool
    }
}
