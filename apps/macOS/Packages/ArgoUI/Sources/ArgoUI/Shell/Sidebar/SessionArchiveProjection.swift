import ArgoDesign
import ArgoEngine

/// Every word and mark the archive gesture is drawn with — `SessionRenameProjection`'s counterpart
/// for the roster's other verb, reached from the menu bar and from the row's swipe action.
enum SessionArchiveProjection {
    /// Whether this archive has to be asked about first (#1290, #1596).
    ///
    /// The subject of the question is LIVE WORK, so only two things have to be true together:
    ///
    /// - it is an ARCHIVE. Putting a Session back starts nothing.
    /// - its agent is MID-TURN. Between Turns there is nothing in flight to lose, and a prompt on
    ///   every archive is a prompt that stops being read.
    ///
    /// `starting` counts as mid-turn. Argo launched that process and has not heard it yet, which
    /// makes it the one status where live work is DIRECT rather than read.
    ///
    /// Access is deliberately NOT asked about. It used to be, and the effect was that the rows
    /// Argo cannot end were the same rows it never warned about: an unowned Session mid-turn was
    /// archived with no prompt, and its agent went on working with no row left to say so (#1596).
    /// What ownership decides is `confirmMessage`'s words, never whether the reader is asked.
    static func confirms(status: SessionStatus, archiving: Bool) -> Bool {
        guard archiving else { return false }
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

    /// What this archive does to the agents behind it, split by whether Argo can end them (#1596).
    ///
    /// `ending` is the Sessions this window holds a claim on: archiving those closes their PTY.
    /// `staying` is every other running one — started by somebody else, or by a run of Argo that
    /// has since quit — where the claim that held the handle is gone and the archive reaches only
    /// the row. A reader given one number for the two cannot tell which agents survive the
    /// gesture, and that is precisely the state the roster was lying about.
    static func confirmMessage(ending: Int, staying: Int) -> String {
        guard staying > 0 else { return ends(count: ending) }
        guard ending > 0 else { return outlives(count: staying) }
        return """
        These agents are working. Archiving ends \(ending) of them and takes every Session off \
        the roster. Argo cannot end the other \(staying), because this window did not start \
        them, so they keep running. Putting a Session back keeps its history.
        """
    }

    /// What is lost and what is not, in that order. The second sentence is the load-bearing one:
    /// ending the agent is not losing the work, and a reader who does not know that will keep a
    /// finished Session on the roster rather than risk it.
    private static func ends(count: Int) -> String {
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

    /// The archive that reaches the row and not the agent. It says the refusal and its reason
    /// before saying what archiving still does, because the refusal is the surprising half: the
    /// reader pressed a gesture whose whole reputation is that it ends things.
    private static func outlives(count: Int) -> String {
        guard count == 1 else {
            return """
            Their agents are working, and Argo cannot end them: this window did not start those \
            processes. Archiving takes the Sessions off the roster and the agents keep running. \
            Putting them back keeps the history.
            """
        }
        return """
        Its agent is working, and Argo cannot end it: this window did not start that process. \
        Archiving takes the Session off the roster and the agent keeps running. Putting it back \
        keeps the history.
        """
    }

    /// The button says both halves of what it does. "Archive" alone would read as the gesture that
    /// only hid the row, which is the behaviour this prompt exists because of.
    ///
    /// Where nothing will be ended it says so by saying LESS, not by promising an end that will
    /// not happen. "Anyway" is the word carrying the message's refusal onto the button, so the
    /// reader who skipped the paragraph still presses something honest.
    static func confirmVerb(ending: Int) -> String {
        ending > 0 ? "Archive and End" : "Archive Anyway"
    }

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
