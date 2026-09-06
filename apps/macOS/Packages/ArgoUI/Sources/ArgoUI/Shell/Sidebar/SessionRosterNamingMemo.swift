import ArgoEngine

/// The roster's naming pass, remembered, so the sidebar and the deck header share ONE of them
/// (#1557, ADR-0028 Rule 1).
///
/// Both surfaces ask on every pass and neither can see the other: the sidebar names the roster in
/// `ShellSidebar.navigator`, and the header names it again in `SessionsRoomReading.init` to
/// subscript one title out. Nothing above them holds the answer — `CockpitView.body` re-runs on
/// any of its own state changes as well as on every presentation the Hub publishes, so a value
/// assembled there would pay the pass for a keystroke in the composer. Remembering it here is what
/// makes the shared answer free rather than merely singular.
///
/// Keyed by the SESSIONS THEMSELVES, and that is the point: a naming pass reads the workspace, the
/// entry, the access, the explicit name, the linked Ticket and the derived title, and a stamp
/// listing those is a stamp a later input falls quietly out of. Value equality over the whole
/// roster cannot drift — `TicketsRoomMemo` is keyed the same way and for the same reason — with the
/// comparison answered by the array's storage first, and CHARGED where it is not.
///
/// ONE entry. Argo's cockpit is a `Window` and not a `WindowGroup`, so the shell draws one roster
/// at a time, and a second roster arriving simply replaces the one before it. Replacing rather than
/// pooling is also what bounds what is RETAINED: an entry holds a whole published roster, events
/// and all, and a pool of them would hold that many generations of it (ADR-0028 Rule 4).
@MainActor
enum SessionRosterNamingMemo {
    private struct Entry {
        let sessions: [CockpitPresentation.Session]
        let namings: SessionRosterNamings
    }

    private static var held: Entry?

    /// The naming pass over this roster, taken only where nothing holds one.
    static func namings(across sessions: [CockpitPresentation.Session]) -> SessionRosterNamings {
        if let held, held.sessions.matches(sessions) {
            return held.namings
        }
        counted(\.passes)
        let namings = SessionRosterNamings(across: sessions)
        held = Entry(sessions: sessions, namings: namings)
        return namings
    }

    /// Nothing remembered. For a suite that needs a cold memo; nothing in the app calls it, because
    /// a roster that has moved is a miss and replaces what it missed.
    static func forget() {
        held = nil
        #if DEBUG
            cost = SessionRosterNamingCost()
        #endif
    }

    #if DEBUG
        /// What the memo did not save, counted rather than timed (ADR-0028 Rule 8).
        static var cost = SessionRosterNamingCost()
    #endif

    private static func counted(_ derivation: WritableKeyPath<SessionRosterNamingCost, Int>) {
        #if DEBUG
            cost[keyPath: derivation] += 1
        #endif
    }
}

/// How many whole-roster derivations the memo could NOT avoid. Zero on a repeat pass is the claim.
struct SessionRosterNamingCost {
    /// One per `SessionRosterNamings(across:)` — which is two `SessionTitle` passes, the roster's
    /// list and the archive's, counted as the one thing they are built as.
    var passes = 0
    /// How many Sessions the key had to walk, charged whenever the roster's own storage could not
    /// answer the comparison. Zero while the shell hands the same published array every pass, which
    /// it does.
    var compared = 0
}

private extension [CockpitPresentation.Session] {
    /// Whether this roster is the one `other` names — answered by the array's own storage first
    /// (`holdsTheStorageOf`), and CHARGED where it is not: a caller that started rebuilding the
    /// roster every pass would make this key a walk of the whole list, which is this type's own
    /// defect wearing another hat, and charging it is what lets the cost suite see that rather than
    /// let it pass quietly.
    @MainActor
    func matches(_ other: [CockpitPresentation.Session]) -> Bool {
        if !holdsTheStorageOf(other) {
            #if DEBUG
                SessionRosterNamingMemo.cost.compared += count
            #endif
        }
        return self == other
    }
}
