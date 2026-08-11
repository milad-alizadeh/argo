import ArgoEngine

/// What the vessel SAYS about the tools a Session has stopped asking about (#572). Every sentence
/// about a standing allow is written here and nowhere else — #572 exists because a label drifted
/// from the grant behind it.
enum StandingAllowProjection {
    /// The whole truth about the scope: the grant is keyed by this Session's claim, it covers every
    /// call to the named tool, and it goes when the Session does.
    private static let scopePhrase = "in this Session"

    /// Said ONCE over the chips rather than on each of them.
    static let trayLabel = "Always allowed \(scopePhrase)"

    /// The words on the control that makes a grant.
    static func offer(_ toolName: String) -> String {
        "Always allow \(toolName) \(scopePhrase)"
    }

    /// What the × on a chip does. The tray's own label is not read out beside a chip reached by
    /// keyboard, so this sentence has to carry both the tool and the scope.
    static func revocation(_ toolName: String) -> String {
        "Stop always allowing \(toolName) \(scopePhrase)"
    }

    /// The grants to draw, and none for a Session that has made none.
    static func allows(for session: CockpitPresentation.Session?) -> [StandingAllow] {
        session?.standingAllows ?? []
    }
}
