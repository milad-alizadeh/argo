import ArgoEngine

/// The Sessions the rename renders are drawn from — one already renamed, one nobody has touched,
/// and the roster the two are met on.
///
/// Projected through `SessionRosterProjection` exactly as the shell projects it, so a PNG is
/// evidence about the dialog the app opens rather than about a value a specimen assembled.
enum RenameDialogFixture {
    /// A Session carrying a name somebody typed, which is the only state the Reset exists in. The
    /// name is SHORTER than the title under it on purpose: the caption has to read as the title
    /// being gone back to rather than as a second field.
    static let renamed = rename(of: "renamed")

    /// The first rename of a Session: the field seeded with the derived title, and nothing under
    /// it. Only judgeable beside the case above — the claim is that a panel with no Reset on it is
    /// still a complete panel rather than one a control fell out of.
    static let untouched = rename(of: "untouched")

    /// The roster both are opened from. An explicit name beside two derived titles, because a
    /// renamed row only reads as renamed against rows that are not (#502, story 19).
    static let rows = SessionRosterProjection.rows(from: sessions)

    private static func rename(of id: String) -> SessionRenameProjection.Rename {
        (rows.first { $0.id == id } ?? rows[0]).rename
    }

    private static let sessions = [
        CockpitPresentation.Session(
            id: "renamed",
            title: "Ship the native Liquid Glass application shell with a deliberately long title",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .running,
            workspace: .init(branch: "argo/#515-rename-session"),
            explicitName: "Tonight's rename run",
        ),
        CockpitPresentation.Session(
            id: "untouched",
            title: "Correct the design docs the next session would design from",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/argo",
            access: .managed,
            status: .idle,
            workspace: .init(branch: "argo/#504-correct-design-docs"),
            lastSeenAtMs: CockpitPresentation.minutesAgo(46),
        ),
        CockpitPresentation.Session(
            id: "observed",
            title: "Watch an externally launched agent work",
            model: nil,
            workspaceLocation: "/Users/milad/Developer/cockpit",
            access: .external,
            status: .idle,
            workspace: .init(branch: "main"),
            lastSeenAtMs: CockpitPresentation.minutesAgo(4 * 60),
        ),
    ]
}
