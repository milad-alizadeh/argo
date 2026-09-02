import ArgoEngine

/// What a Row is assembled from — one value per reading it comes from (#755, #999), the way
/// `CockpitPresentation.Session` is. The Row itself stays flat: every surface that draws a row
/// reads `row.title` and `row.clock`, and a grouping is how the facts ARRIVE rather than a second
/// shape for them to be read through.
extension SessionRosterProjection.Row {
    /// What names this Session — and, on `rename`, the same name in the form the dialog behind a
    /// double-click opens with.
    struct Identity {
        let id: String
        let title: String
        let rename: SessionRenameProjection.Rename
    }

    /// What the Session is working on: the folder it runs in, the label the roster tells that
    /// folder apart by, its branch, and the one fact its meta line leads with.
    struct Work {
        let location: String?
        let worktree: String?
        let branch: String?
        let toldApart: String?
    }

    /// What the Session is doing right now, drawn and spoken — the dot's reading, its word, and
    /// the one age slot in both forms.
    struct Activity {
        let state: ArgoOperationalState?
        let stateWord: String?
        let clock: SessionRosterProjection.Clock?
        let spokenClock: String?
    }

    /// What the reader may do with the row: drive the Session or only watch it, and whether the
    /// row is on the roster or behind its foot.
    struct Availability {
        let isReadOnly: Bool
        let lock: String?
        let isArchived: Bool
    }
}
