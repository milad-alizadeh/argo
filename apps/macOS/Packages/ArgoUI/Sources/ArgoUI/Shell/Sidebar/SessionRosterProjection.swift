import ArgoEngine
import Foundation

enum SessionRosterProjection {
    struct Row: Identifiable, Sendable {
        let id: String
        let title: String
        /// Never drawn — the branch took that line — but the tooltip and the copy actions
        /// still address the Session by it.
        let location: String?
        /// The row's second line, and the only thing that tells two Sessions in one repo
        /// apart. Absent for a Session that has not branched, rather than a placeholder
        /// standing where a branch nobody can check out would go.
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
            branch: String?,
            isReadOnly: Bool,
            age: String?,
            state: ArgoOperationalState?,
            stateWord: String?,
        ) {
            self.id = id
            self.title = title
            self.location = location
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
                branch.map { "on \($0)" },
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
        return sessions.map { session in
            Row(
                id: session.id,
                title: session.title,
                location: session.workspaceLocation,
                branch: session.workspace?.branch,
                isReadOnly: isReadOnly(session.access),
                age: age(status: session.status, lastSeenAtMs: session.lastSeenAtMs, nowMs: nowMs),
                state: state(for: session.status),
                stateWord: stateWord(for: session.status),
            )
        }
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
