/// What the deck's header zone says about the Session it is showing — the roster projection's
/// counterpart above the feed, at the same altitude and in the same shape.
///
/// Every honesty rule the header carries lives HERE rather than in the view that draws it: which
/// facts a posture is allowed to claim, and which word each of them spends. A view can be looked
/// at, but it cannot be asserted, and a rule that only exists inside a `body` is a rule nothing
/// can hold to. The zones the later header tickets fill — the context reading and what it offers
/// to do about it — land on `Header` for the same reason.
enum SessionHeaderProjection {
    struct Header: Equatable, Sendable {
        /// The word a Session spends on its access, and what that word MEANS in a sentence for
        /// the surface that can afford one. ONE value, because the two are one fact: two
        /// optionals beside each other would let a header have an explanation of nothing.
        struct AccessMark: Equatable, Sendable {
            let word: String
            let detail: String
        }

        /// A fact drawn rather than spelled: a glyph, the count it carries, and the sentence that
        /// says what it counts. `•3 ↑1` needs a key; a pencil and a push-arrow do not — but a
        /// mark is still ink, so the sentence travels WITH it rather than being left to the
        /// surface that happens to draw a tooltip.
        ///
        /// The count is optional because one mark counts nothing: a worktree is a yes or a no.
        struct Mark: Equatable, Sendable {
            let symbol: String
            let count: Int?
            let detail: String
        }

        /// The linked Work Item as the header says it: `Issue #400`, never a bare `#400` — a
        /// number on its own is whatever the reader last saw one of. The detail is the issue's
        /// own title where the provider gave one, and absent rather than invented where it did
        /// not.
        struct IssueLink: Equatable, Sendable {
            let label: String
            let detail: String?
        }

        /// The Session's own title, verbatim. Never shortened, completed or re-capitalised: the
        /// header names its subject rather than describing it.
        let title: String
        /// The mark a Session spends when it is not a plain managed one, and `nil` when it is —
        /// the default state is silent, and a mark drawn on every header is a mark that has
        /// stopped meaning anything by the second Session.
        let access: AccessMark?
        /// The branch, verbatim and whole. Cutting it is the VIEW's job and only the view's: how
        /// much of a name fits is a width, and a projection that ellipsized would decide it for
        /// every width at once.
        let branch: String?
        /// The worktree marker and the git counts, in reading order. Empty for a Session whose
        /// git state Argo has not read — an unread count is not a clean tree.
        let marks: [Mark]
        /// What is running: `Claude Code · Opus 5`. Composed of the parts that are present, so a
        /// Session whose record named a model but no CLI reads as the model alone.
        let agent: String?
        let issue: IssueLink?

        /// `fileprivate`, so `header(from:)` is the only way a header comes into being and no
        /// surface can assemble one that disagrees with what the projection decided.
        fileprivate init(
            title: String,
            access: AccessMark?,
            branch: String?,
            marks: [Mark],
            agent: String?,
            issue: IssueLink?,
        ) {
            self.title = title
            self.access = access
            self.branch = branch
            self.marks = marks
            self.agent = agent
            self.issue = issue
        }

        /// What a screen reader hears: the same facts the header draws, said out loud — because
        /// a mark is ink and ink is nothing a screen reader can hear. Each mark says what it
        /// counts rather than naming its glyph.
        var announcement: String {
            ([title, access?.word, branch.map { "on \($0)" }]
                + marks.map(\.detail)
                + [agent, issue?.label])
                .compactMap(\.self)
                .joined(separator: ", ")
        }
    }

    static func header(from session: CockpitPresentation.Session) -> Header {
        Header(
            title: session.title,
            access: mark(for: session.access),
            branch: session.workspace?.branch,
            marks: marks(for: session.workspace),
            agent: agent(cli: session.cli, model: session.model),
            issue: link(to: session.issue),
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
