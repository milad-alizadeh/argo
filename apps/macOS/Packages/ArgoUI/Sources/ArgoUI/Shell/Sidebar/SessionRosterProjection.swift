import ArgoEngine
import Foundation

enum SessionRosterProjection {
    struct Row: Identifiable, Sendable {
        let id: String
        let title: String
        /// Never drawn — the worktree label stands in for it — but the tooltip and the copy
        /// actions still address the Session by it.
        let location: String?
        /// The row's second line: which worktree this Session is in, named by the shortest
        /// suffix that tells it apart from the others on the roster.
        ///
        /// The worktree rather than the branch, because it is the higher-tier fact (a `cwd` is
        /// DIRECT for a managed Session, and can never render as `HEAD`), because it does not
        /// move under a reader mid-scan the way a branch does, and because it is the actionable
        /// one — where you would `cd`, and what says two Sessions cannot collide.
        ///
        /// Absent for a Session in the Project's own checkout — a line spent on the folder every
        /// unisolated Session shares tells nothing apart, which is exactly what D30 deletes —
        /// and absent again where Argo has not read git, because a label is a claim that the
        /// folder IS a worktree, and an unread kind is not a `main` one.
        let worktree: String?
        /// Never drawn either: the branch belongs to the session header. Kept so the row's copy
        /// action can still hand it over.
        let branch: String?
        /// True of every Session Argo does not own the terminal of, and always announced.
        ///
        /// The row draws it by ghosting — the whole row quieter, title, branch, age and dot
        /// together — rather than by a mark beside one of them. "You cannot drive this" is a
        /// property of the row, and a property of the row is spent on all of its ink or none:
        /// a glyph is a thing to hunt for, and it can only ever be attached to one element.
        let isReadOnly: Bool
        /// How long ago this Session last did anything — the key the roster is ordered on, said
        /// out loud, so the order stops looking arbitrary. Absent for a Session that is running
        /// and for one whose record carries no time to word.
        let age: String?
        let state: ArgoOperationalState?
        /// The dot carries `running`, `idle` and `ended`; a word is spent only where the roster
        /// needs the user to stop scanning. D30 keeps counts and words to what helps the scan.
        let stateWord: String?

        /// `fileprivate`, so `rows(from:)` is the only way a row comes into being and no surface
        /// can assemble one that disagrees with what the projection decided.
        fileprivate init(
            id: String,
            title: String,
            location: String?,
            worktree: String?,
            branch: String?,
            isReadOnly: Bool,
            age: String?,
            state: ArgoOperationalState?,
            stateWord: String?,
        ) {
            self.id = id
            self.title = title
            self.location = location
            self.worktree = worktree
            self.branch = branch
            self.isReadOnly = isReadOnly
            self.age = age
            self.state = state
            self.stateWord = stateWord
        }

        /// What a screen reader hears: the same `stateWord` the row draws, so the two can never
        /// make different claims, plus the read-only fact — which the row spends on ink a screen
        /// reader has no way to hear, and so has to say out loud here.
        var announcement: String {
            [
                title,
                stateWord,
                isReadOnly ? "Read-only Session" : nil,
                worktree.map { "in \($0)" },
                age.map { "last active \($0)" },
            ]
            .compactMap(\.self)
            .joined(separator: ", ")
        }
    }

    /// `now` is a parameter because an age is arithmetic against a moment, and a projection that
    /// read the clock itself would answer differently on every call with nothing able to say so.
    static func rows(from sessions: [CockpitPresentation.Session], now: Date = Date()) -> [Row] {
        let nowMs = now.epochMs
        let worktrees = worktrees(of: sessions)
        return zip(sessions, worktrees).map { session, worktree in
            Row(
                id: session.id,
                title: session.title,
                location: session.workspaceLocation,
                worktree: worktree,
                branch: session.workspace?.branch,
                isReadOnly: isReadOnly(session.access),
                age: age(status: session.status, lastSeenAtMs: session.lastSeenAtMs, nowMs: nowMs),
                state: state(for: session.status),
                stateWord: stateWord(for: session.status),
            )
        }
    }

    /// The label each row spends on its workspace, decided across the WHOLE roster: how short a
    /// name can be and still tell one Session from another is a question about its neighbours,
    /// which is why this is one pass over the list rather than a per-row derivation.
    ///
    /// Every row that draws no label is dropped BEFORE the labels are decided, so a silent row is
    /// not a rival either: it must not push the worktree rows into longer names to be told apart
    /// from something nobody can see.
    ///
    /// Which folders are worktrees is git's answer (`WorkspaceProjection.Kind`) rather than a
    /// shape read off the path — Argo's own worktrees live INSIDE the checkout they branch from,
    /// so no amount of prefix-matching separates the two.
    private static func worktrees(of sessions: [CockpitPresentation.Session]) -> [String?] {
        DistinguishingLabel.labels(for: sessions.map {
            $0.workspace?.kind == .worktree ? $0.workspaceLocation : nil
        })
    }

    /// Whether the whole row is drawn as a Session nobody here can drive.
    ///
    /// A `switch` and not `!= .managed`, so a posture arriving on this axis has to answer the
    /// question rather than inherit an answer. The two that do are one row rendering on purpose:
    /// the roster is a SWITCHER, and "you cannot drive this" is all of it a row needs to say —
    /// which of the two it is belongs to the header, where there is room to name it.
    private static func isReadOnly(_ access: CockpitPresentation.Session.Access) -> Bool {
        switch access {
        case .managed: false
        case .external, .orphaned: true
        }
    }

    /// A running Session has no age: the dot already says it is live, and `just now` repeated
    /// down the roster is the noise D30 deletes.
    private static func age(
        status: SessionStatus, lastSeenAtMs: Int?, nowMs: Int,
    )
        -> String? {
        guard status != .running, let lastSeenAtMs else { return nil }
        return SessionAge.phrase(sinceMs: lastSeenAtMs, nowMs: nowMs)
    }

    /// Session status → the four colour roles the visual contract carries.
    ///
    /// `unknown` takes no dot at all: a tint is a claim about what the Session is doing, and the
    /// contract has no colour for "we cannot say". The absence is the honest rendering, and the
    /// row already announces everything it does know.
    private static func state(for status: SessionStatus) -> ArgoOperationalState? {
        switch status {
        case .running: .running
        case .permission, .asking: .attention
        case .idle, .ended: .idle
        case .stopped: .failure
        case .unknown: nil
        }
    }

    /// Session status → the word the row spends on it, if any.
    ///
    /// Read off the status rather than off the colour role beside it, so a second status
    /// arriving on `.failure` cannot inherit a word that was never about it — and `Stopped`
    /// means the agent stopped short, never that anything crashed (`CONTEXT.md` L2).
    private static func stateWord(for status: SessionStatus) -> String? {
        switch status {
        case .permission, .asking: "Needs input"
        case .stopped: "Stopped"
        case .running, .idle, .ended, .unknown: nil
        }
    }
}
