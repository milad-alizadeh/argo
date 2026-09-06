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
        opened: Set<String> = [],
        focus: Focus = Focus(),
        now: Date = Date(),
    )
        -> [Row] {
        rows(from: sessions, named: nil, in: Pass(
            isArchived: false, opened: opened, focus: focus, nowMs: now.epochMs,
        ))
    }

    /// Both of the roster's lists, off ONE naming pass — what the sidebar draws, and the only place
    /// the two are projected together.
    struct Lists {
        let rows: [Row]
        let archived: [Row]
    }

    /// The sidebar's whole projection, named once (#1557). `@MainActor` for the memo it reads, and
    /// so the deck header — the other surface asking what the roster calls a Session — is answered
    /// out of the same pass rather than taking a second one.
    @MainActor
    static func lists(
        from sessions: [CockpitPresentation.Session],
        opened: Set<String>,
        focus: Focus,
        now: Date,
    )
        -> Lists {
        let namings = SessionRosterNamingMemo.namings(across: sessions)
        // One clock for both lists, for the reason `Pass.nowMs` states: two lists off two moments
        // would age the same Session two ways.
        let nowMs = now.epochMs
        return Lists(
            rows: rows(from: sessions, named: namings, in: Pass(
                isArchived: false, opened: opened, focus: focus, nowMs: nowMs,
            )),
            archived: rows(from: sessions, named: namings, in: Pass(
                isArchived: true, opened: opened, focus: focus, nowMs: nowMs,
            )),
        )
    }

    /// One pass over the roster: which of the two lists it is drawing, which folds the reader has
    /// opened, and what the deck is drawing — a fold holding the selection is open whatever the
    /// reader did, for the reason the archive foot is.
    struct Pass {
        let isArchived: Bool
        let opened: Set<String>
        /// The row the deck has open, and its fourth fact (#1513).
        let focus: Focus
        /// The moment the whole pass is arithmetic against, so no two rows age off two clocks —
        /// the open row's fourth fact included, which is why `Focus` is taken already dated.
        let nowMs: Int
    }

    /// What is behind the foot of the roster. The same rows by the same rules — a Session put out
    /// of sight is not a Session described differently.
    package static func archivedRows(
        from sessions: [CockpitPresentation.Session],
        opened: Set<String> = [],
        focus: Focus = Focus(),
        now: Date = Date(),
    )
        -> [Row] {
        rows(from: sessions, named: nil, in: Pass(
            isArchived: true, opened: opened, focus: focus, nowMs: now.epochMs,
        ))
    }

    /// One list of the roster. `named` is the pass a caller drawing BOTH lists already took, so the
    /// two of them share it; `nil` takes one here, which is what a caller holding a single list —
    /// a specimen, a fixture, a suite — wants.
    private static func rows(
        from sessions: [CockpitPresentation.Session],
        named namings: SessionRosterNamings?,
        in pass: Pass,
    )
        -> [Row] {
        // Decided before the split and filtered after: a Session's workspace label is told apart
        // from every other Session's, whichever of the two lists each is drawn in.
        let kept = zip(sessions, decided(across: sessions, named: namings, in: pass))
            .filter { session, _ in session.isArchived == pass.isArchived }
        // Once over the list this pass is drawing, never once per row (ADR-0028) — and over the
        // kept half, so a fold's count is what the reader can see rather than what is behind the
        // foot as well.
        let folding = Folding(
            of: kept.map { pair in pair.0 },
            isArchived: pass.isArchived, opened: pass.opened, selecting: pass.focus.sessionID,
        )
        let byID = Dictionary(uniqueKeysWithValues: sessions.map { ($0.id, $0) })
        return kept.flatMap { session, decided -> [Row] in
            [
                folding.fold(opening: session).map { fold in
                    let runs = folding.runs(foldedWith: session).compactMap { byID[$0] }
                    return foldRow(fold, at: session, of: runs, in: pass)
                },
                folding.drawsOwnRow(session)
                    ? row(for: session, decided: decided, in: pass) : nil,
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

    private static func decided(
        across sessions: [CockpitPresentation.Session],
        named namings: SessionRosterNamings?,
        in pass: Pass,
    )
        -> [Decided] {
        let named = namings?.namings(isArchived: pass.isArchived)
            ?? self.namings(across: sessions, isArchived: pass.isArchived)
        return zip(named, worktrees(of: sessions)).map(Decided.init)
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
