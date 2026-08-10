/// The Sessions the header specimens are rendered from — one per access posture.
///
/// A value type beside the view rather than statics inside it, for the reason `PlanFixture` is
/// one: a fixture is data, and data a test reads has no business needing the main actor. The
/// headers are projected here exactly as the shell projects them, so a PNG is evidence about the
/// rendering the app produces rather than about a value a specimen assembled.
enum SessionHeaderFixture {
    /// Every posture's header, in `Access.allCases` order — what the catalog is checked against,
    /// so a posture nothing renders fails a test rather than shipping unlooked-at.
    static let headers = CockpitPresentation.Session.Access.allCases.map(header(for:))

    static func header(for access: CockpitPresentation.Session.Access)
        -> SessionHeaderProjection.Header {
        SessionHeaderProjection.header(from: session(for: access))
    }

    private static func session(
        for access: CockpitPresentation.Session.Access,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "header-\(access)",
            title: title(for: access),
            model: "claude-opus-5",
            workspaceLocation: "/Users/milad/Developer/argo",
            branch: "argo/#509-session-header-title",
            access: access,
            status: .idle,
        )
    }

    /// The external one's title is long enough to be CUT at the narrowest deck, deliberately: a
    /// mark that survives only in a wide window is a mark drawn for fixtures, and the render this
    /// exists for is whether `READ-ONLY` still sits beside a title the line could not hold.
    private static func title(
        for access: CockpitPresentation.Session.Access,
    )
        -> String {
        switch access {
        case .managed:
            "Ship the native Liquid Glass application shell with a deliberately long title"
        case .external:
            "Review a Session nobody here started, and decide whether the reading it left "
                + "behind is worth keeping or should be archived tonight"
        case .orphaned:
            "Resume a Session whose terminal Argo lost"
        }
    }
}
