import ArgoEngine

enum SessionRosterProjection {
    struct Row: Identifiable, Sendable {
        let id: String
        let title: String
        /// The full path the Session sits at. Never drawn on the row — the branch took that
        /// line — but the tooltip and the copy actions still address the Session by it.
        let location: String?
        /// The row's second line, and the only thing that tells two Sessions in one repo apart.
        /// Absent for a Session that has not branched: the row then has one line, rather than a
        /// placeholder standing where a branch nobody can check out would go.
        let branch: String?
        /// Always true of an observed Session, and always announced. Only the *glyph* is
        /// conditional, so hiding it never hides the fact.
        let isReadOnly: Bool
        /// The lock is drawn only when read-only tells the rows apart.
        let showsLock: Bool
        let state: ArgoOperationalState?

        /// `fileprivate`, so `rows(from:)` is the only way a row comes into being and a
        /// `showsLock` that disagrees with `isReadOnly` stops being representable.
        fileprivate init(
            id: String,
            title: String,
            location: String?,
            branch: String?,
            isReadOnly: Bool,
            showsLock: Bool,
            state: ArgoOperationalState?,
        ) {
            self.id = id
            self.title = title
            self.location = location
            self.branch = branch
            self.isReadOnly = isReadOnly
            self.showsLock = showsLock
            self.state = state
        }

        /// The dot carries `running` and `idle`; a word is spent only where the roster needs
        /// the user to stop scanning. D30 keeps counts and words to what helps the scan.
        var stateWord: String? {
            switch state {
            case .attention: "Needs you"
            case .failure: "Failed"
            case .running, .idle, nil: nil
            }
        }
    }

    static func rows(from sessions: [CockpitPresentation.Session]) -> [Row] {
        let access = sessions.map(\.access)
        let locksDistinguish = access.contains(.readOnly) && access.contains(.managed)
        return sessions.map { session in
            Row(
                id: session.id,
                title: session.title,
                location: session.workspaceLocation,
                branch: session.branch,
                isReadOnly: session.access == .readOnly,
                showsLock: locksDistinguish && session.access == .readOnly,
                state: state(for: session.status),
            )
        }
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
}
