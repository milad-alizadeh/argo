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
        /// The word a Session spends on its access, what that word MEANS in a sentence for the
        /// surface that can afford one, and how loudly it is set. ONE value, because the three are
        /// one fact: optionals beside each other would let a header have an explanation of nothing.
        struct AccessMark: Equatable, Sendable {
            let word: String
            let detail: String
            /// The operational role the word is set in, and `nil` for the line's own quiet ink.
            ///
            /// Which of the two read-only postures is worth a colour is a rule about the POSTURES,
            /// not about the line they land on — a view choosing it would decide the same thing
            /// again for every surface that ever draws one. The contract's own enum rather than a
            /// second one beside it, so the role→palette mapping stays in one place.
            let tone: ArgoOperationalState?
        }

        /// The branch, and which KIND of checkout it names.
        ///
        /// One value with the symbol in it, because a worktree is not a second fact sitting after
        /// the branch — it is a different drawing OF the branch. Two fields would let a header
        /// draw a worktree mark against no branch at all.
        struct Checkout: Equatable, Sendable {
            /// The branch, verbatim and whole. Cutting it is the VIEW's job and only the view's:
            /// how much of a name fits is a width, and a projection that ellipsized would decide
            /// it for every width at once.
            let branch: String
            /// The mark the branch is drawn under, and **`nil` when Argo has not read the kind**.
            ///
            /// The glyph is now the only thing that tells the two kinds apart, so an unread kind
            /// must draw NOTHING rather than the plain branch mark: that mark says "not a
            /// worktree", which is a claim, and `CONTEXT.md`'s degrade-down rule gives an
            /// unestablished fact an absent rendering rather than the nearest guess.
            let symbol: String?
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
        /// The branch and the kind of checkout it is on, or nothing for a Session that has not
        /// branched.
        let checkout: Checkout?
        /// The git counts, in reading order. Empty for a Session whose git state Argo has not
        /// read — an unread count is not a clean tree.
        let marks: [Mark]
        /// What is running: `Claude Code · Opus 5`. Composed of the parts that are present, so a
        /// Session whose record named a model but no CLI reads as the model alone.
        let agent: String?
        let issue: IssueLink?
        /// The one instrument on the header. Never absent: a Session whose context cannot be read
        /// still has a context, and an instrument that disappeared would say the fact does not
        /// apply rather than that Argo could not establish it. The absence lives INSIDE the
        /// reading, as `unknown`.
        let context: Context

        /// `fileprivate`, so `header(from:)` is the only way a header comes into being and no
        /// surface can assemble one that disagrees with what the projection decided.
        fileprivate init(
            title: String,
            access: AccessMark?,
            checkout: Checkout?,
            marks: [Mark],
            agent: String?,
            issue: IssueLink?,
            context: Context,
        ) {
            self.title = title
            self.access = access
            self.checkout = checkout
            self.marks = marks
            self.agent = agent
            self.issue = issue
            self.context = context
        }

        /// What a screen reader hears of the Session's IDENTITY: the facts on the header's leading
        /// half, in the order it draws them — because a mark is ink and ink is nothing a screen
        /// reader can hear. Each mark says what it counts rather than naming its glyph, and the
        /// checkout says which kind it is in words rather than by which of two glyphs got drawn.
        ///
        /// The context reading is deliberately not in it. The instrument is its own element on the
        /// line — it has to be, since it carries a control — and it announces itself
        /// (`Context.detail`); saying it here as well would read the same number out twice.
        var announcement: String {
            ([title, agent, issue?.label, checkout?.detail]
                + marks.map(\.detail)
                + [access?.word])
                .compactMap(\.self)
                .joined(separator: ", ")
        }
    }

    static func header(from session: CockpitPresentation.Session) -> Header {
        Header(
            title: session.title,
            access: mark(for: session.access),
            checkout: checkout(for: session.workspace),
            marks: marks(for: session.workspace),
            agent: agent(cli: session.cli, model: session.model),
            issue: link(to: session.issue),
            context: context(tokens: session.contextTokens),
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
                // No colour: a Session Argo never owned is an ordinary thing to be looking at, and
                // a tint on every external header would train the reader past the other one.
                tone: nil,
            )
        case .orphaned:
            Header.AccessMark(
                word: "Orphaned",
                detail: "Argo owned this Session; its terminal died with the process, "
                    + "so it cannot be driven from here.",
                // Something was LOST here, and the reader had every reason to expect otherwise.
                tone: .attention,
            )
        }
    }
}
