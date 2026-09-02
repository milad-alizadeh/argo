import ArgoEngine

/// What the shell remembers about a Tickets room it has already derived, so SELECTING a ticket
/// costs a lookup rather than another pass over the whole listing (ADR-0028 Rule 1).
///
/// `navigation.ticket` is one `Int?`. Changing it invalidates `CockpitView.body`, which reassembles
/// the room — and the selected number is an input to NONE of what that reassembles: not the tree,
/// not the bands, not the views' counts, not the Next-Up ranking. A click on a backlog row was
/// paying two filters over every item, five more over the open set, a tree build with a sibling
/// sort per node, and the ranking's fold, for a highlight.
///
/// Held oldest-first and evicted from the front, bounded by the rooms a reader actually moves
/// between: `TicketsView.allCases`, one remembered room per view, so flipping the sidebar's four
/// and coming back re-derives nothing. A ceiling read off the document rather than written as a
/// literal (ADR-0028 Rule 4).
///
/// Keyed by a STAMP, and the stamp is the reading ITSELF with the selection cleared. A count cannot
/// stand in for a listing the way it does for a Session's stream: a stream is append-only, so a
/// count names a prefix, while a poll REPLACES the listing — a title edited, a ticket closed and a
/// blocker resolved all leave the count where it was. A stamp that compares equal therefore names
/// the same listing fact for fact, and a field added to `TicketsReading` later joins it by
/// construction rather than by somebody remembering to add it.
@MainActor
enum TicketsRoomMemo {
    /// Everything the room is a function of EXCEPT which ticket is open.
    struct Stamp: Equatable {
        /// The reading with `showing` cleared — see the type's note. Cleared rather than merely
        /// ignored, so nothing held under this stamp can carry a selection at all.
        let reading: TicketsReading
        let view: TicketsView
        /// The search field's raw query. Folded inside the derivation, so the stamp holds what was
        /// typed and two spellings that fold alike are two stamps — a miss, never a wrong room.
        let query: String

        init(of reading: TicketsReading, in view: TicketsView, matching query: String) {
            self.reading = reading.opened(at: nil)
            self.view = view
            self.query = query
        }

        /// Whether this stamp names the room `other` was taken for. Value equality over the WHOLE
        /// reading, so no field can fall out of the key — with the listing answered by its storage
        /// first, and the tally CHARGED where it is not.
        ///
        /// The app hands the same stored `[Ticket]` every pass, which is what makes the key free.
        /// A caller that started rebuilding the array would make every pass an element-by-element
        /// walk of the whole listing — this type's own defect wearing another hat — and charging
        /// it is what lets the cost suite see that rather than pass quietly.
        @MainActor
        func matches(_ other: Stamp) -> Bool {
            if !reading.items.holdsTheStorageOf(other.reading.items) {
                TicketsRoomTally.compared(reading.items.count)
            }
            return self == other
        }
    }

    /// What one stamp is worth remembering: the room with nothing open, and the index the detail is
    /// answered from. Both are functions of the stamp alone, which is why they are held together.
    struct Held {
        /// `ticket` and `unreadNumber` are absent here by construction — `TicketsRoomProjection`
        /// fills them per pass from the LIVE selection, so a remembered room can never draw a
        /// remembered detail.
        let room: TicketsRoomProjection.Room
        let listing: TicketsListing
    }

    /// How many rooms are remembered: one per sidebar view, because that is the set a reader moves
    /// between. A query narrows within a view and evicts the unnarrowed room it came from, which is
    /// correct — typing is not a round trip.
    static var ceiling: Int {
        TicketsView.allCases.count
    }

    private struct Entry {
        let stamp: Stamp
        let held: Held
    }

    private static var entries: [Entry] = []

    /// The room at this stamp, derived only where nothing holds one.
    static func held(at stamp: Stamp, otherwise derive: () -> TicketsRoomProjection.Room) -> Held {
        if let found = entries.firstIndex(where: { stamp.matches($0.stamp) }) {
            // To the back, which is the LRU order the eviction below reads.
            let entry = entries.remove(at: found)
            entries.append(entry)
            return entry.held
        }
        TicketsRoomTally.derived(over: stamp.reading.items.count)
        let held = Held(room: derive(), listing: TicketsListing(of: stamp.reading))
        entries.append(Entry(stamp: stamp, held: held))
        evictOldest()
        return held
    }

    /// Everything remembered, dropped. For a suite that needs a cold memo; nothing in the app calls
    /// it, because a stamp that has moved is a miss and the entry behind it ages out.
    static func forget() {
        entries.removeAll()
    }

    /// Oldest first, one at a time — never `removeAll` as an overflow policy (ADR-0028 Rule 4). The
    /// room just derived is never evicted: dropping it would derive it again on the next pass.
    private static func evictOldest() {
        while entries.count > ceiling {
            entries.removeFirst()
        }
    }
}

private extension [Ticket] {
    /// Whether these two hold the same STORAGE, which for a listing means the same tickets: the
    /// memo retains its own reference, so nothing can write into that buffer in place — a write to
    /// a shared array copies it first (`reallocated`, ADR-0028 #1070).
    func holdsTheStorageOf(_ other: [Ticket]) -> Bool {
        count == other.count && withUnsafeBufferPointer { mine in
            other.withUnsafeBufferPointer { theirs in mine.baseAddress == theirs.baseAddress }
        }
    }
}
