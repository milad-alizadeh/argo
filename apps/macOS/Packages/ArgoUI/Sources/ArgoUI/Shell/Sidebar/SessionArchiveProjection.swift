import ArgoDesign
import ArgoEngine

/// Every word and mark the archive gesture is drawn with — `SessionRenameProjection`'s counterpart
/// for the roster's other verb, reached from the menu bar and from the row's swipe action.
enum SessionArchiveProjection {
    /// Whether this archive has to be asked about first (#1290).
    ///
    /// Archiving a Session Argo owns ends its agent, so the one archive worth a prompt is the one
    /// that ends live work. Three things have to be true together, and each rules out a prompt
    /// nobody would understand:
    ///
    /// - it is an ARCHIVE. Putting a Session back starts nothing.
    /// - Argo OWNS it. An `external` Session reads `running` off its own transcript and Argo has no
    ///   channel to it; an `orphaned` one's process is already gone. Neither ends anything.
    /// - its agent is MID-TURN. Between Turns there is nothing in flight to lose, and a prompt on
    ///   every archive is a prompt that stops being read.
    ///
    /// `starting` counts as mid-turn. Argo launched that process and has not heard it yet, which
    /// makes it the one status where ownership of live work is DIRECT rather than read.
    static func confirms(
        access: CockpitPresentation.Session.Access,
        status: SessionStatus,
        archiving: Bool,
    )
        -> Bool {
        guard archiving, access == .managed else { return false }
        return switch status {
        case .starting, .running, .permission, .asking: true
        case .idle, .stopped, .ended, .unknown: false
        }
    }

    /// The prompt names the Session rather than asking about "this session": the gesture is on the
    /// menu bar too, where the row it acts on may be scrolled out of view. A batch is COUNTED
    /// instead (#1247) — a title listing four names is a title nobody reads.
    static func confirmTitle(names: [String]) -> String {
        guard names.count == 1, let one = names.first else {
            return "Archive \(names.count) Sessions?"
        }
        return "Archive \u{201C}\(one)\u{201D}?"
    }

    /// What is lost and what is not, in that order. The second sentence is the load-bearing one:
    /// ending the agent is not losing the work, and a reader who does not know that will keep a
    /// finished Session on the roster rather than risk it.
    static func confirmMessage(count: Int) -> String {
        guard count == 1 else {
            return """
            Their agents are working. Archiving ends those agents and takes the Sessions off the \
            roster. Putting them back keeps the history, and each can be continued from there.
            """
        }
        return """
        Its agent is working. Archiving ends that agent and takes the Session off the roster. \
        Putting it back keeps the history, and it can be continued from there.
        """
    }

    /// The button says both halves of what it does. "Archive" alone would read as the gesture that
    /// only hid the row, which is the behaviour this prompt exists because of.
    static let confirmVerb = "Archive and End"
    /// Title Case, as menu items are, and the noun spelled out: a menu carries no row, so the item
    /// has to say what it acts on (#800).
    static func menuTitle(isArchived: Bool) -> String {
        isArchived ? "Put Back on the Roster" : "Archive Session"
    }

    /// The same verb over a whole selection (#1247). One row keeps the singular the menu bar
    /// uses; more than one says how many, because the menu is the only place the reader can see
    /// what a batch covers before pressing it.
    static func menuTitle(isArchived: Bool, count: Int) -> String {
        guard count > 1 else { return menuTitle(isArchived: isArchived) }
        return isArchived
            ? "Put \(count) Sessions Back on the Roster"
            : "Archive \(count) Sessions"
    }

    /// The same verb on the row, which is already the Session the menu has to name. The swipe
    /// action is only as wide as its word, so the menu's noun would both repeat the row and
    /// stretch the button past every other one in the cockpit (#1257).
    static func rowTitle(isArchived: Bool) -> String {
        isArchived ? "Put Back" : "Archive"
    }

    static func symbol(isArchived: Bool) -> String {
        isArchived ? ArgoSymbol.unarchive : ArgoSymbol.archive
    }

    /// What the menu item reads with nothing selected — derived, so the disabled item cannot come
    /// to say something the enabled one does not.
    static var fallbackTitle: String {
        menuTitle(isArchived: false)
    }
}
