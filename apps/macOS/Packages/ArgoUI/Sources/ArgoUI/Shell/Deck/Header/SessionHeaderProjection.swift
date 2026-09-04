import ArgoDesign

/// What the deck's header zone says about the Session it is showing — the roster projection's
/// counterpart above the feed.
package enum SessionHeaderProjection {
    package struct Header: Equatable, Sendable {
        struct AccessMark: Equatable, Sendable {
            let word: String
            let detail: String
            /// The operational role the word is set in, and `nil` for the line's own quiet ink.
            let tone: ArgoOperationalState?
        }

        /// The branch, and which KIND of checkout it names.
        struct Checkout: Equatable, Sendable {
            /// Verbatim and whole; cutting it to a width is the view's job.
            let branch: String
            /// The mark the branch is drawn under, and **`nil` when Argo has not read the kind**:
            /// the plain branch mark says "not a worktree", which is a claim, and `CONTEXT.md`'s
            /// degrade-down rule renders an unestablished fact as absent, not as a guess.
            let symbol: String?
            /// The worktree folder's own name, where it is not the branch's (#1199). The roster
            /// row used to carry this and no longer does, so the header is now the only place a
            /// reader can learn WHICH folder a Session is checked out in.
            ///
            /// `nil` for a checkout that is not a worktree, for one whose kind Argo has not read,
            /// and — the common case — for a worktree the branch already names.
            let worktree: String?
            let detail: String
        }

        /// A glyph, the count it carries, and the sentence saying what it counts — a mark is ink,
        /// so the sentence travels WITH it for anything that cannot render a glyph.
        ///
        /// The count is optional because one mark counts nothing: a worktree is a yes or a no.
        struct Mark: Equatable, Sendable {
            let symbol: String
            let count: Int?
            let detail: String
        }

        /// What the Issue row draws. The row used to VANISH where nothing was linked, which told
        /// a reader nothing about whether there was a link to expect or a branch to repair.
        ///
        /// Two cases and not three, unlike the reading behind it: `unread` has no row at all, and
        /// that is the header's `nil` above. The optional is a RENDERING absence — draw nothing
        /// here — where `TicketLinkReading.unread` is a domain one, and folding them into one
        /// enum would make every reader of this type answer a question about the Binding.
        enum IssueRow: Equatable, Sendable {
            case link(IssueLink)
            /// A provider is bound and nothing named a Ticket for this Session.
            case unlinked

            /// The link where the row is one, for the surfaces that draw only a link.
            var link: IssueLink? {
                switch self {
                case let .link(link): link
                case .unlinked: nil
                }
            }

            /// What the row reads as, on the line and out loud. Never blank: a row that draws
            /// nothing is the absence #894 replaced.
            var label: String {
                switch self {
                case let .link(link): link.label
                case .unlinked: Header.unlinkedWord
                }
            }

            /// The title behind the link, and nothing for the row that is not one.
            var detail: String? {
                link?.detail
            }
        }

        /// What an unlinked Session's Issue row says. States the reading rather than blaming the
        /// Session: Argo could not name a Ticket for it, and cutting a branch that says which one
        /// is the repair.
        static let unlinkedWord = "No ticket linked"

        /// …and what it says instead once there IS a backlog to pick from (#1092). The ellipsis is
        /// the only thing on this line that says a press opens a choice rather than a room, and the
        /// word is a verb because the reading above is one a reader can now act on.
        static let linkVerb = "Link a ticket…"

        /// The linked Ticket as the header says it: `Issue #400`, never a bare `#400`. The
        /// detail is the issue's own title where the provider gave one, absent where it did not.
        struct IssueLink: Equatable, Sendable {
            /// Beside the label, so the ⓘ panel can say the bare `#476` under a term that already
            /// says `Issue` without unpicking the label to get at it.
            let number: Int
            let label: String
            let detail: String?
        }

        /// The Session's name, verbatim — the user's own where they set one, otherwise the
        /// derived one (`SessionTitle`). Never shortened, completed or re-capitalised.
        let title: String
        /// What the Session is waiting for, and `nil` for every status that spends no word.
        ///
        /// `SessionState`'s reading rather than the header's own mapping: one word per state
        /// wherever it appears is `cockpit-status-vocabulary.md`'s one rule.
        let state: SessionState.Reading?
        /// The mark a Session spends when it is not a plain managed one, and `nil` when it is.
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
        /// The Issue row: a link where one was read, and the word for the reading where none
        /// was. `nil` only where no Ticket provider is bound, which is the one state with nothing
        /// to say (#894).
        let issue: IssueRow?
        /// The one instrument on the header, and **`nil` for a Session that has reported no spend
        /// yet** — the zone draws nothing at all rather than a placeholder (#1249). An unreadable
        /// context is still a context and lives INSIDE the reading, as `unknown`.
        package let context: Context?
        /// What the Session has spent and how long it has been going, already composed — the tab
        /// line's whole content. `nil` where none of those facts could be established, so the
        /// line collapses rather than drawing separators between facts it does not have.
        let spend: String?
        /// The remedy, when it is the right move and Argo is the one who can take it — see
        /// `handoff(from:)` for the two facts that decide it.
        package let handoff: Handoff?
        /// The same facts as rows, for the ⓘ panel — the route to them that a keyboard and a
        /// screenshot both have, which `tooltip` above is not (#694).
        package let facts: [Fact]

        /// `fileprivate`, so `header(from:)` is the only way a header comes into being. Taken as
        /// one value per zone (`SessionHeaderProjection+HeaderValues.swift`) and unpacked onto the
        /// flat slots above, which is the shape every surface draws a header through.
        fileprivate init(
            identity: Identity,
            state: SessionState.Reading?,
            telemetry: Telemetry,
            facts: [Fact],
        ) {
            self.title = identity.title
            self.agent = identity.agent
            self.issue = identity.issue
            self.checkout = identity.checkout
            self.marks = identity.marks
            self.access = identity.access
            self.state = state
            self.context = telemetry.context
            self.spend = telemetry.spend
            self.handoff = telemetry.handoff
            self.facts = facts
        }

        /// What a screen reader hears of the Session's IDENTITY: the facts on the header's leading
        /// half, in the order it draws them. Each mark says what it counts rather than naming its
        /// glyph, and the checkout says which kind it is in words.
        ///
        /// The context reading is deliberately not in it: the instrument is its own element and
        /// announces itself (`Context.detail`), so repeating it here reads the number out twice.
        var announcement: String {
            ([title, agent, issue?.label, checkout?.detail]
                + marks.map(\.detail)
                + [access?.word])
                .compactMap(\.self)
                .joined(separator: ", ")
        }

        /// Everything the header's fact line and the tab line used to say out loud, on the hover of
        /// the titlebar title that replaced them (#692) — identity first, one fact per line, then a
        /// blank line and the telemetry exactly as the tab line worded it.
        ///
        /// The checkout and the access posture are their SENTENCES rather than their words: the two
        /// facts the reader hovers for are which kind of checkout it is and why the composer is
        /// shut, and neither is answered by a branch name or by `Read-only` alone.
        ///
        /// `nil`, never empty: `.help("")` still draws a chip, which reads as a fact that failed to
        /// load rather than as a Session nothing is known about.
        var tooltip: String? {
            let facts = [agent, branchLine, issueLine, access?.detail].compactMap(\.self)
            let halves = [facts.joined(separator: "\n"), spend ?? ""].filter { !$0.isEmpty }
            return halves.isEmpty ? nil : halves.joined(separator: "\n\n")
        }

        /// The branch and what is unsaved on it, on ONE line — the marks hang off the branch on the
        /// line they used to be drawn on, and nothing else renders them now that the line is gone.
        private var branchLine: String? {
            guard let checkout else { return nil }
            return ([checkout.detail] + marks.map(\.detail)).joined(separator: " · ")
        }

        /// The issue as the header worded it, carrying the provider's own title where there is one.
        /// The label alone is what the line SAID; the title was on the label's own hover, and with
        /// that hover gone this is the only place left for it.
        private var issueLine: String? {
            guard let issue else { return nil }
            return [issue.label, issue.detail].compactMap(\.self).joined(separator: " — ")
        }
    }

    /// `worked` is the one figure below that walks the whole event stream, handed in by a caller
    /// that has already taken it at a known stamp (`SessionsRoomReadingCache`) and read here
    /// otherwise. It is the only header fact a remembered reading may carry: everything else moves
    /// with no event appended.
    package static func header(
        from session: CockpitPresentation.Session,
        worked: Worked? = nil,
    )
        -> Header {
        let worked = worked ?? .read(across: session.events)
        return Header(
            identity: Header.Identity(
                // The same chain the roster row reads, through the same function (#502, story 19).
                title: SessionTitle.resolved(for: session),
                agent: agent(cli: session.cli),
                issue: row(for: session.ticket),
                checkout: checkout(for: session.workspace, at: session.workspaceLocation),
                marks: marks(for: session.workspace),
                access: mark(for: session.access),
            ),
            state: SessionState.reading(for: session.status),
            telemetry: Header.Telemetry(
                context: context(reading: session.context),
                spend: spend(from: session, worked: worked),
                handoff: handoff(from: session),
            ),
            facts: facts(from: session, worked: worked),
        )
    }

    /// Access → the mark the header spends on it, if any. `external` and `orphaned` differ: both
    /// are undriveable, but only one was ever Argo's.
    ///
    /// The WORD comes from `SessionComposerProjection.Unavailable`, which is the one home for it
    /// (#546); the sentence stays the header's own, because the band names a posture where the
    /// deck's foot answers a reader looking for the field.
    static func mark(
        for access: CockpitPresentation.Session.Access,
    )
        -> Header.AccessMark? {
        switch access {
        case .managed:
            nil
        case .external:
            Header.AccessMark(
                word: SessionComposerProjection.Unavailable.external.word,
                detail: "Argo never owned this Session's terminal, "
                    + "so it cannot be driven from here.",
                // No colour: a tint on every external header trains the reader past the other one.
                tone: nil,
            )
        case .orphaned:
            Header.AccessMark(
                word: SessionComposerProjection.Unavailable.orphaned.word,
                detail: "Argo owned this Session; its terminal died with the process, "
                    + "so it cannot be driven from here.",
                tone: .attention,
            )
        }
    }
}
