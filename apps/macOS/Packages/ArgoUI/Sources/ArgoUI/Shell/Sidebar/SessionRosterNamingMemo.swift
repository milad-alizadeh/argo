import ArgoEngine

/// The roster's naming pass, remembered, so the sidebar and the deck header share ONE of them
/// (#1557, ADR-0028 Rule 1).
///
/// Both surfaces ask every pass and neither can see the other, and nothing above them holds the
/// answer: `CockpitView.body` re-runs on any of its own state changes as well as on every
/// presentation the Hub publishes, so a value assembled there would pay the pass for a keystroke in
/// the composer.
///
/// Keyed by the SESSIONS THEMSELVES, and that is the point: naming reads the workspace, the entry,
/// the access, the explicit name, the linked Ticket and the derived title, and a stamp listing
/// those is one a later input falls quietly out of. `TicketsRoomMemo` is keyed the same way.
///
/// ONE entry. The cockpit is a `Window` and not a `WindowGroup`, so the shell draws one roster at a
/// time. Replacing rather than pooling is also what bounds what is RETAINED: an entry holds a whole
/// published roster, events and all (ADR-0028 Rule 4).
@MainActor
enum SessionRosterNamingMemo {
    private struct Entry {
        let sessions: [CockpitPresentation.Session]
        let namings: SessionRosterNamings
    }

    private static var held: Entry?

    /// The naming pass over this roster, taken only where nothing holds one.
    static func namings(across sessions: [CockpitPresentation.Session]) -> SessionRosterNamings {
        if let held, matches(held.sessions, sessions) {
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

    /// Whether the roster held is the one being asked about — answered by the array's own STORAGE
    /// first, and charged where it is not. This memo retains its own reference, so nothing can
    /// write into a matched buffer in place: a write to a shared array copies it first (ADR-0028
    /// #1070). A caller that started rebuilding the roster every pass would make this key a walk of
    /// the whole list, which is this type's own defect wearing another hat, and charging it is what
    /// lets the cost suite see that rather than let it pass quietly.
    private static func matches(
        _ held: [CockpitPresentation.Session], _ asked: [CockpitPresentation.Session],
    )
        -> Bool {
        if !holdsTheSameStorage(held, asked) {
            counted(\.compared, by: held.count)
        }
        return held == asked
    }

    private static func holdsTheSameStorage(
        _ held: [CockpitPresentation.Session], _ asked: [CockpitPresentation.Session],
    )
        -> Bool {
        held.count == asked.count && held.withUnsafeBufferPointer { mine in
            asked.withUnsafeBufferPointer { theirs in mine.baseAddress == theirs.baseAddress }
        }
    }

    private static func counted(
        _ derivation: WritableKeyPath<SessionRosterNamingCost, Int>, by amount: Int = 1,
    ) {
        #if DEBUG
            cost[keyPath: derivation] += amount
        #endif
    }
}

/// How many whole-roster derivations the memo could NOT avoid. Zero on a repeat pass is the claim.
struct SessionRosterNamingCost {
    /// One per `SessionRosterNamings(across:)` — which is two `SessionTitle` passes, the roster's
    /// list and the archive's, counted as the one thing they are built as.
    var passes = 0
    /// How many Sessions the key had to walk. Zero while the shell hands the same published array
    /// every pass, which it does.
    var compared = 0
}
