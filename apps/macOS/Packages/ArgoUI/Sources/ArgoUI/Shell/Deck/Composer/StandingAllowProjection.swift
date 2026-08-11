import ArgoEngine

/// What the vessel SAYS about the tools a Session has stopped asking about (#572), derived the way
/// the composer's other facts are: off the presentation, in a projection a test can hold still.
///
/// Every sentence about a standing allow is written here and nowhere else. The control that makes a
/// grant, the tray that records it and the control that takes it back are three surfaces describing
/// one thing, and #572 exists because a label drifted from the grant behind it — *Always allow Bash
/// here* over a set that covered every call to that tool. Three literals in three files is how that
/// happens again.
enum StandingAllowProjection {
    /// The scope every one of those sentences ends in — and the whole truth about it: the grant is
    /// keyed by this Session's claim, it covers every call to the named tool, and it goes when the
    /// Session does.
    private static let scopePhrase = "in this Session"

    /// Said ONCE over the chips rather than on each of them, so the tray states its scope in full
    /// without a row of chips each repeating it.
    static let trayLabel = "Always allowed \(scopePhrase)"

    /// The words on the control that makes a grant, naming the tool and the same scope the tray
    /// states back.
    static func offer(_ toolName: String) -> String {
        "Always allow \(toolName) \(scopePhrase)"
    }

    /// What the × on a chip does, said in full: the tray's own label is not read out beside a chip
    /// reached by keyboard, so this one sentence has to carry both the tool and the scope.
    static func revocation(_ toolName: String) -> String {
        "Stop always allowing \(toolName) \(scopePhrase)"
    }

    /// The grants to draw, and none for a Session that has made none — a tray with no chips in it
    /// is chrome announcing the state every Session starts in.
    static func allows(for session: CockpitPresentation.Session?) -> [StandingAllow] {
        session?.standingAllows ?? []
    }
}
