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
    /// folder by, its branch, and the fact its meta line falls back to.
    struct Work {
        let location: String?
        let worktree: String?
        let branch: String?
        let toldApart: String?
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

        let state: ArgoOperationalState?
        let stateWord: String?
        let clock: SessionRosterProjection.Clock?
        let spokenClock: String?
        /// `nil` on every row that is not a running Session with a call behind it — see
        /// `SessionRosterProjection.activity(of:in:)`.
        let activity: String?
        /// What runs under this Session, or a fold of several
        /// (`SessionRosterProjection.subagents`).
        /// `nil` where `state` is, and for the same reason (rule 5).
        let subagents: SessionRosterProjection.SubagentReading?

        init(
            dot: Dot,
            age: Age,
            activity: String?,
            subagents: SessionRosterProjection.SubagentReading? = nil,
        ) {
            self.state = dot.state
            self.stateWord = dot.word
            self.clock = age.clock
            self.spokenClock = age.spoken
            self.activity = activity
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
