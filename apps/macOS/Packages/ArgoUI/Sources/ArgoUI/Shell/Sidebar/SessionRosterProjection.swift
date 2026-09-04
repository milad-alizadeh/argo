import ArgoDesign
import ArgoEngine
import Foundation

package enum SessionRosterProjection {
    /// The roster proper: everything the user has not cleared off it.
    ///
    /// The filter is on Argo's own flag and on nothing observed, so a Session whose transcript
    /// grew a second ago is as absent as one that has not moved in a week (#502, stories 14, 16).
    ///
    /// `now` is a parameter so an age is arithmetic against a fixed moment rather than the clock.
    package static func rows(
        from sessions: [CockpitPresentation.Session],
        viewing: Viewing = .none,
        now: Date = Date(),
    )
        -> [Row] {
        rows(from: sessions, in: Pass(isArchived: false, viewing: viewing), now: now)
    }

    /// What the WINDOW is doing, as against which Sessions there are: the folds the reader has
    /// opened, what the deck is drawing, and whether each Subagent's own file is growing.
    ///
    /// One value because the cap on a parameter list is four and these three arrive together from
    /// one place — and because every one of them is a fact about the surface rather than about the
    /// roster, so a call site reading `viewing:` is reading them under the name they share.
    package struct Viewing {
        let opened: Set<String>
        let selection: String?
        /// Whether Argo has watched this Subagent's own file grow (#1269) — the evidence the
        /// parent's record does not hold, and the fourth fact behind every running claim
        /// (`FeedAgents.told(_:writing:at:)`). Handed IN because reading it is the engine's, and
        /// `@MainActor`: this projection is a pure function and stays one.
        let writing: @Sendable (String) -> SubagentWriting

        /// A window doing nothing in particular, and the honest default: no fold opened, nothing
        /// selected, and no child watched growing. A specimen and a suite are exactly that.
        package static let none = Viewing()

        package init(
            opened: Set<String> = [],
            selection: String? = nil,
            writing: @escaping @Sendable (String) -> SubagentWriting = { _ in .quiet },
        ) {
            self.opened = opened
            self.selection = selection
            self.writing = writing
        }
    }

    /// One pass over the roster: which of the two lists it is drawing, which folds the reader has
    /// opened, and what the deck is drawing — a fold holding the selection is open whatever the
    /// reader did, for the reason the archive foot is.
    struct Pass {
        let isArchived: Bool
        let viewing: Viewing

        var opened: Set<String> {
            viewing.opened
        }

        var selection: String? {
            viewing.selection
        }
    }

    /// What is behind the foot of the roster. The same rows by the same rules — a Session put out
    /// of sight is not a Session described differently.
    package static func archivedRows(
        from sessions: [CockpitPresentation.Session],
        viewing: Viewing = .none,
        now: Date = Date(),
    )
        -> [Row] {
        rows(from: sessions, in: Pass(isArchived: true, viewing: viewing), now: now)
    }

    private static func rows(
        from sessions: [CockpitPresentation.Session], in pass: Pass, now: Date,
    )
        -> [Row] {
        let nowMs = now.epochMs
        // Decided before the split and filtered after: the kept rows and the archived ones are
        // drawn in one column, so a Session told apart only from its own list would come out
        // reading the same as one in the other.
        let kept = zip(sessions, decided(across: sessions))
            .filter { session, _ in session.isArchived == pass.isArchived }
        // Once over the list this pass is drawing, never once per row (ADR-0028) — and over the
        // kept half, so a fold's count is what the reader can see rather than what is behind the
        // foot as well.
        let folding = Folding(of: kept.map { pair in pair.0 }, in: pass)
        // Once per Session and read twice: the Session's own row reads its own list, and the fold
        // above it reads the lists it hides joined (`Folding.subagents(under:from:)`).
        let subagents = Dictionary(uniqueKeysWithValues: kept.map { session, _ in
            (session.id, self.subagents(
                of: session, in: session.events, writing: pass.viewing.writing, nowMs: nowMs,
            ))
        })
        return kept.flatMap { session, decided -> [Row] in
            [
                folding.fold(opening: session).map {
                    foldRow(
                        $0, at: session, nowMs: nowMs,
                        delegation: reading(of: folding.subagents(under: session, from: subagents)),
                    )
                },
                folding.drawsOwnRow(session)
                    ? row(
                        for: session, decided: decided, nowMs: nowMs,
                        delegation: reading(of: subagents[session.id] ?? []),
                    ) : nil,
            ]
            .compactMap(\.self)
        }
    }

    /// What the two whole-roster passes settled for one Session: the name it draws and the label
    /// its workspace goes by. Neither is answerable from the Session alone.
    struct Decided {
        let naming: SessionTitle.Naming
        let worktree: String?
    }

    private static func decided(across sessions: [CockpitPresentation.Session]) -> [Decided] {
        zip(SessionTitle.namings(across: sessions), worktrees(of: sessions)).map(Decided.init)
    }

    /// The label each row spends on its workspace, decided across the WHOLE roster in one pass:
    /// how short a name can be and still tell one Session apart depends on its neighbours.
    ///
    /// Every row that draws no label is dropped BEFORE the labels are decided, so a silent row
    /// cannot push the worktree rows into longer names.
    ///
    /// Which folders are worktrees is git's answer (`WorkspaceProjection.Kind`), not a shape read
    /// off the path — Argo's worktrees live INSIDE the checkout they branch from, so no amount
    /// of prefix-matching separates the two.
    private static func worktrees(of sessions: [CockpitPresentation.Session]) -> [String?] {
        DistinguishingLabel.labels(for: sessions.map {
            $0.workspace?.kind == .worktree ? $0.workspaceLocation : nil
        })
    }
}
