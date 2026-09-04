import ArgoEngine

/// The Ticket a Session is ON, read off the two things that can name one — the number Argo was
/// told at the spawn, and the number its branch spells (#745, #872, #1092).
///
/// Its own file rather than a third of `CockpitPresentation+Hub.swift`: nothing here reads a
/// `HubSession` fact at all, so it is not part of the projection's totality — it is the derivation
/// the projection takes the result of.
extension CockpitPresentation.Session.Issue {
    /// The Ticket this Session's git context names, and `nil` where it names none (#745).
    ///
    /// Two readings, and the DIRECT one wins: `claimed` is the ticket Argo was told to start this
    /// Session on (#872), and the branch is the DERIVED convention `docs/agents/worktrees.md` fixes
    /// (#745). The title came from outside Argo either way.
    ///
    /// The claim is asked first because it is the earlier and the firmer of the two: a Session
    /// started on a ticket is claimed before anything has cut a branch to read the number off, and
    /// a Session whose branch was later renamed is still the one that was started for it.
    ///
    /// Each link carries the tier that produced it, so the two are never rendered as each other.
    ///
    /// Three ways to have no link, and all three draw nothing rather than a guess: no claim, a
    /// branch carrying no `#<N>`, and — once the host has been asked — a number it has nothing
    /// behind. A number nobody has asked about yet keeps its link and carries no title, which
    /// `SessionTitle` drops back to the derived name.
    init?(claimed: Int?, branch: String?, location: String?, title: TicketTitleReading?) {
        // The claim is asked first and is never dropped by the host: Argo was TOLD this number at
        // the spawn, so an `absent` lookup says the host could not name it, not that the Session is
        // on nothing. Only the DERIVED reading — a number guessed off a branch — needs the host to
        // confirm it, because there a misread `#<N>` and a real ticket look identical.
        if let claimed {
            self.init(number: claimed, title: title?.title, tier: .direct)
            return
        }
        guard let number = Self.derived(branch: branch, location: location, title: title)
        else { return nil }
        self.init(number: number, title: title?.title, tier: .derived)
    }

    /// Which of the two numbers Argo OWNS about a Session is the one it is on: the Ticket a reader
    /// attached by hand, and the one Argo was told at the spawn (#1092). Both land on `claimed`
    /// above, which is why the ranking is here rather than inside it — the init sees one number.
    ///
    /// The pin wins. It is the LATER of the two and the only one a reader can revise: a Session
    /// spawned on the wrong ticket, or spawned on none at all, has no other repair — where a spawn
    /// claim, once made, is a fact about a moment that has passed. Both are DIRECT either way, so
    /// nothing downstream renders them as each other.
    static func directNumber(pinnedTo pin: Int?, claimedAt spawn: Int?) -> Int? {
        pin ?? spawn
    }

    /// The number a git context names, once the host has had its say. `nil` where the branch names
    /// none, and where it names one the host answered has nothing behind — a branch naming a ticket
    /// that does not exist (`TicketTitleReading.absent`).
    private static func derived(
        branch: String?, location: String?, title: TicketTitleReading?,
    )
        -> Int? {
        guard title != .absent else { return nil }
        return TicketLink.number(branch: branch, workspaceLocation: location)
    }
}
