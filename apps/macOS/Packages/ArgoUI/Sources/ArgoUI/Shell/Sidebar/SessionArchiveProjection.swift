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
    /// Access is not asked about: ownership decides `confirmMessage`'s words, never whether the
    /// reader is asked (#1596).
    static func confirms(status: SessionStatus, archiving: Bool) -> Bool {
        guard archiving else { return false }
        return switch status {
        case .starting, .running, .permission, .asking: true
        case .idle, .stopped, .ended, .unknown: false
        }
    }

    /// Whether archiving this Session will actually end its agent (#1596).
    ///
    /// `managed` is exactly the set this window holds a live claim on, which is exactly the set
    /// `Hub.endSession` reaches: `SessionOwnership.provenance` grades a Session `managed` on the
    /// same bound-claim read `ownerOf` returns at. `external` was never Argo's, and `orphaned`
    /// had a claim that has since stood down — from here the two are one case, because what the
    /// end needs is a claim and neither has one.
    ///
    /// It lives beside the copy it selects rather than in the view that asks, so the join the
    /// whole prompt rests on is a value a test can pin.
    static func endsAgent(access: CockpitPresentation.Session.Access) -> Bool {
        switch access {
        case .managed: true
        case .external, .orphaned: false
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
    /// `staying` is every other running one, where the claim that held the handle is gone and the
    /// archive reaches only the row. A reader given one number for the two cannot tell which
    /// agents survive the gesture, and that is precisely the state the roster was lying about.
    ///
    /// The staying half is hedged and the ending half is not, because the two facts sit on
    /// different tiers (`CONTEXT.md` · Honesty tier). A claim is DIRECT: Argo holds the PTY and
    /// knows. Without one, liveness is DERIVED off the process table, so the prompt says what
    /// Argo can see rather than what is so.
    static func confirmMessage(ending: Int, staying: Int) -> String {
        guard staying > 0 else { return ends(count: ending) }
        guard ending > 0 else { return outlives(count: staying) }
        guard staying > 1 else {
            return """
            Archiving ends \(spelled(ending)) of these agents and takes every Session off the \
            roster. This window is not holding the other process, so Argo cannot end it and, as \
            far as Argo can see, it keeps running. Putting a Session back keeps its history.
            """
        }
        return """
        Archiving ends \(spelled(ending)) of these agents and takes every Session off the roster. \
        This window is not holding the other \(staying) processes, so Argo cannot end them and, \
        as far as Argo can see, they keep running. Putting a Session back keeps its history.
        """
    }

    /// One written as a word. Every count here shares a sentence with the pronouns answering to
    /// it, and "ends 1 of these agents … the other one" reads as two different kinds of number.
    private static func spelled(_ count: Int) -> String {
        count == 1 ? "one" : String(count)
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
    ///
    /// The reason is the missing CLAIM, never who started the process. A Session an earlier run
    /// of Argo spawned is `orphaned`, and telling that reader Argo did not start it is the
    /// mislabelling ADR-0026 exists to stop.
    private static func outlives(count: Int) -> String {
        guard count == 1 else {
            return """
            This window is not holding those processes, so Argo cannot end those agents and, as \
            far as Argo can see, they are still working. Archiving takes the Sessions off the \
            roster and they keep running. Putting them back keeps the history.
            """
        }
        return """
        This window is not holding that process, so Argo cannot end the agent and, as far as \
        Argo can see, it is still working. Archiving takes the Session off the roster and the \
        agent keeps running. Putting it back keeps the history.
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
