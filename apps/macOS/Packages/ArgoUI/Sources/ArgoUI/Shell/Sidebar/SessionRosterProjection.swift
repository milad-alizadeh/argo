import ArgoEngine

enum SessionRosterProjection {
    /// The word every tier-gated fact degrades to. One spelling, because a roster that says
    /// "unknown" in one column and something else in the next reads as two different claims.
    static let unknown = "unknown"

    struct Row: Identifiable, Sendable {
        let id: String
        let title: String
        let model: String
        let workspaceIdentity: String
        let location: String?
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
            model: String,
            workspaceIdentity: String,
            location: String?,
            branch: String?,
            isReadOnly: Bool,
            showsLock: Bool,
            state: ArgoOperationalState?,
        ) {
            self.id = id
            self.title = title
            self.model = model
            self.workspaceIdentity = workspaceIdentity
            self.location = location
            self.branch = branch
            self.isReadOnly = isReadOnly
            self.showsLock = showsLock
            self.state = state
        }

        var metadata: String {
            "\(model) · \(workspaceIdentity)"
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
        let identities = workspaceIdentities(for: sessions.map(\.workspaceLocation))
        let access = sessions.map(\.access)
        let locksDistinguish = access.contains(.readOnly) && access.contains(.managed)
        return zip(sessions, identities).map { session, identity in
            Row(
                id: session.id,
                title: session.title,
                model: session.model ?? unknown,
                workspaceIdentity: identity,
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

    /// A Session whose location names nothing degrades to the roster's one `unknown`, which is
    /// the word this file owns — the shared rule reports the absence and spells none of it.
    private static func workspaceIdentities(for locations: [String?]) -> [String] {
        DistinguishingLabel.labels(for: locations).map { $0 ?? unknown }
    }
}
