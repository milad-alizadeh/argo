import ArgoEngine

/// The Sessions the rename renders are drawn from — one already renamed, one nobody has touched,
/// and the roster the two are met on. Projected through `SessionRosterProjection` exactly as the
/// shell projects it, so a PNG is evidence about the row the app draws.
enum RenameFixture {
    /// The roster the rename is met on: an explicit name beside two derived titles, because a
    /// renamed row only reads as renamed against rows that are not (#502, story 19).
    static let rows = SessionRosterProjection.rows(from: sessions)

    /// Which row `EditingRowSpecimen` opens the field on: the one nobody has renamed, which is the
    /// state the field is met in.
    static let editingRowID = untouchedSession.id

    /// Named by the Session rather than looked up in the rows above, so the specimen cannot open
    /// its field on a search that quietly missed and took the other row.
    private static let renamedSession = CockpitPresentation.Session(
        id: "renamed",
        title: "Ship the native Liquid Glass application shell with a deliberately long title",
        access: .managed,
        status: .running,
        work: .init(
            location: "/Users/milad/Developer/argo",
            workspace: .init(branch: "argo/#515-rename-session"),
        ),
        annotations: .init(explicitName: "Tonight's rename run"),
    )

    private static let untouchedSession = CockpitPresentation.Session(
        id: "untouched",
        title: "Correct the design docs the next session would design from",
        access: .managed,
        status: .idle,
        chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(46))),
        work: .init(
            location: "/Users/milad/Developer/argo",
            workspace: .init(branch: "argo/#504-correct-design-docs"),
        ),
    )

    private static let sessions = [
        renamedSession,
        untouchedSession,
        CockpitPresentation.Session(
            id: "observed",
            title: "Watch an externally launched agent work",
            access: .external,
            status: .idle,
            chain: .init(span: .init(lastSeenAtMs: CockpitPresentation.minutesAgo(4 * 60))),
            work: .init(
                location: "/Users/milad/Developer/cockpit",
                workspace: .init(branch: "main"),
            ),
        ),
    ]
}
