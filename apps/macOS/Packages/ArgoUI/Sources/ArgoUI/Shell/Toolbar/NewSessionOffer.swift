import ArgoEngine

/// Whether the shell offers to start a Session, and what stands in the way when it does not.
///
/// A spawn runs in the active Project's folder, so there has to BE one and it has to still be
/// there. Both refusals are drawn disabled rather than hidden (#361).
package struct NewSessionOffer: Equatable, Sendable {
    /// The verb, spelled once for both routes to it — the File menu's item and the button's label.
    static let label = "New Session"
    /// The key the MENU owns. The button names it rather than binding it: two controls on one
    /// shortcut is one binding with a loser.
    static let shortcutDescription = "⌘N"
    static let detail = "Starts an agent in the active Project's folder"

    /// Why it cannot be launched, or `nil` when it can. Present means the control is drawn and
    /// DISABLED with this sentence on it.
    let blocked: String?

    var isLaunchable: Bool {
        blocked == nil
    }

    package init(presentation: CockpitPresentation) {
        self.blocked = Self.refusal(from: presentation)
    }

    private static func refusal(from presentation: CockpitPresentation) -> String? {
        guard let project = presentation.activeProject else {
            return "No Project registered — add one to start a Session here"
        }
        guard project.isReachable else {
            // The ENGINE's wording, read off the failure this spawn would raise: one sentence for
            // the disabled tooltip and for the alert, so the two cannot drift.
            return AgentSpawnError.unreachableWorkingDirectory(path: project.location).detail
        }
        return nil
    }
}
