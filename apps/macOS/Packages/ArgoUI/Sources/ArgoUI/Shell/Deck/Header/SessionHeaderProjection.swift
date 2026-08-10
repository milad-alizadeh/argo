/// What the deck's header zone says about the Session it is showing — the roster projection's
/// counterpart above the feed, at the same altitude and in the same shape.
///
/// Every honesty rule the header carries lives HERE rather than in the view that draws it: which
/// facts a posture is allowed to claim, and which word each of them spends. A view can be looked
/// at, but it cannot be asserted, and a rule that only exists inside a `body` is a rule nothing
/// can hold to. The zones the later header tickets fill — the branch and its state, the CLI and
/// model, the linked issue, the context reading — land on `Header` for the same reason.
enum SessionHeaderProjection {
    struct Header: Equatable, Sendable {
        /// The word a Session spends on its access, and what that word MEANS in a sentence for
        /// the surface that can afford one. ONE value, because the two are one fact: two
        /// optionals beside each other would let a header have an explanation of nothing.
        struct AccessMark: Equatable, Sendable {
            let word: String
            let detail: String
        }

        /// The Session's own title, verbatim. Never shortened, completed or re-capitalised: the
        /// header names its subject rather than describing it.
        let title: String
        /// The mark a Session spends when it is not a plain managed one, and `nil` when it is —
        /// the default state is silent, and a mark drawn on every header is a mark that has
        /// stopped meaning anything by the second Session.
        let access: AccessMark?
        /// The branch this Session is on, verbatim — the header is the surface with room for a
        /// ref, which is why the roster row's second line names its worktree instead.
        ///
        /// Absent for a detached checkout and for a Session that never branched. The engine
        /// reads the `HEAD` a detached record carries as the absence it is, so nothing here has
        /// to know the convention to avoid rendering it as a name.
        let branch: String?

        /// `fileprivate`, so `header(from:)` is the only way a header comes into being and no
        /// surface can assemble one that disagrees with what the projection decided.
        fileprivate init(title: String, access: AccessMark?, branch: String?) {
            self.title = title
            self.access = access
            self.branch = branch
        }

        /// What a screen reader hears: the same word the header draws, because a mark is ink and
        /// ink is nothing a screen reader can hear.
        var announcement: String {
            [title, access?.word, branch.map { "on \($0)" }]
                .compactMap(\.self)
                .joined(separator: ", ")
        }
    }

    static func header(from session: CockpitPresentation.Session) -> Header {
        Header(
            title: session.title,
            access: mark(for: session.access),
            branch: session.branch,
        )
    }

    /// Access → the mark the header spends on it, if any.
    ///
    /// Three answers and not two, because `external` and `orphaned` are one axis and two facts:
    /// both are Sessions nobody here can drive, and only one of them was ever Argo's. A header
    /// that spelled them alike would tell somebody their own Session had never been theirs.
    private static func mark(
        for access: CockpitPresentation.Session.Access,
    )
        -> Header.AccessMark? {
        switch access {
        case .managed:
            nil
        case .external:
            Header.AccessMark(
                word: "Read-only",
                detail: "Argo never owned this Session's terminal, "
                    + "so it cannot be driven from here.",
            )
        case .orphaned:
            Header.AccessMark(
                word: "Orphaned",
                detail: "Argo owned this Session; its terminal died with the process, "
                    + "so it cannot be driven from here.",
            )
        }
    }
}
